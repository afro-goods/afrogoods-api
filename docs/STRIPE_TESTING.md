# Stripe integration – testing & .env

---

## Stripe only (no login, no cart)

Use the **guest** flow to hit Stripe without Firebase, registration, or cart:

1. **Create a guest order** (body has items + customer + address). Replace `YOUR_PRODUCT_MONGO_ID` with a **real MongoDB product _id** (24-char hex, e.g. `507f1f77bcf86cd799439011`). The product must exist and have **availabilityStatus: "In Stock"**. If you get "No valid products in cart", the productId format is wrong or the product is missing/not In Stock.

```bash
curl -s -X POST http://localhost:3000/api/orders/guest \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": "YOUR_PRODUCT_MONGO_ID", "quantity": 1 }
    ],
    "customerInfo": {
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "guest@example.com",
      "phone": "+15551234567"
    },
    "shippingAddress": {
      "street": "123 Main St",
      "city": "Toronto",
      "state": "ON",
      "postalCode": "M5V 1A1",
      "country": "Canada"
    }
  }'
```

From the response, copy the **orderId** (e.g. `AG-2502-07123456-12345`).

2. **Get Stripe Checkout URL** (no auth):

```bash
curl -s -X POST http://localhost:3000/api/orders/guest/ORDER_ID/stripe-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"email":"guest@example.com"}'
```

Replace `ORDER_ID` with the value from step 1. Open the returned `url` in a browser and pay with test card **4242 4242 4242 4242**.

You need **STRIPE_SECRET_KEY** and **APP_URL** in `.env`. For the order to be marked paid and confirmation email sent, use the webhook (see “Local webhook testing” below).

---

## How the webhook confirms payment

1. **Stripe sends the webhook**  
   After the customer completes payment, Stripe sends a `POST` request to your webhook URL with event type `checkout.session.completed`. The request body is the event payload; the `Stripe-Signature` header is used to verify it really came from Stripe.

2. **Your API receives it**  
   - Route: `POST /api/webhooks/stripe`  
   - `main.ts` stores the **raw body** for this route (required for signature verification).  
   - The controller reads `req.rawBody` and `stripe-signature`, then calls `Stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)`. If the signature is invalid or the secret is wrong, the request is rejected.

3. **Event is handled**  
   - For `event.type === 'checkout.session.completed'`, the code reads `session.metadata.orderId`, `session.metadata.isGuest`, and (for guest) `session.metadata.guestEmail`.  
   - These values were set when creating the Checkout Session (in `StripeService.createCheckoutSession`).

4. **Order is updated**  
   - `ordersService.markOrderPaidByStripe(orderId, isGuest, guestEmail)` finds the order (by `orderId` and, for guest, optionally by email), sets `isPaid = true`, `status = CONFIRMED`, `paidAt = now`, updates fulfillments to `PROCESSING`, and appends a status history entry with `updatedBy: 'stripe_webhook'`.  
   - If the order was already paid, the method is idempotent and does nothing.

5. **Confirmation email**  
   - After saving, the service sends the order confirmation email (with a "Payment Confirmed" note) to the customer.

So: **Checkout success in the browser does not update your DB by itself.** The webhook is what marks the order paid and sends the email. If the webhook is not reachable or `STRIPE_WEBHOOK_SECRET` is missing/wrong, the payment succeeds in Stripe but your order stays pending.

---

## .env variables for Stripe

**You do not need any Stripe variables to start the server.** The app starts normally without them. Add the following only when you want to use Stripe Checkout or webhooks:

```env
# Front-end URL (used for Stripe success/cancel URLs and emails)
APP_URL=http://localhost:5173

# Stripe (use test keys from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx

# Only needed for webhook signature verification (see “Local webhook testing” below)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

- **STRIPE_SECRET_KEY** – Required to create Checkout Sessions. Use a **test** key (`sk_test_...`) for development.
- **STRIPE_WEBHOOK_SECRET** – Required for `POST /api/webhooks/stripe`. For local testing you get this from the Stripe CLI (see below).
- **APP_URL** – Used for `success_url` and `cancel_url` in Checkout. In dev, set to your frontend (e.g. `http://localhost:5173`).

---

## Quick test (no webhook)

1. Set **STRIPE_SECRET_KEY** and **APP_URL** in `.env`. You can leave **STRIPE_WEBHOOK_SECRET** unset for this step.
2. Start the API: `pnpm run start:dev`.
3. Create an order (registered or guest) using your existing flows.
4. Call the Stripe Checkout endpoint:
   - **Registered:**  
     `POST /api/orders/:orderId/stripe-checkout-session`  
     (with auth header)
   - **Guest:**  
     `POST /api/orders/guest/:orderId/stripe-checkout-session`  
     Body: `{ "email": "guest@example.com" }`
5. Use the returned `{ "url": "https://checkout.stripe.com/..." }` in the browser.
6. On Stripe Checkout use test card: **4242 4242 4242 4242**, any future expiry, any CVC, any postal code.
7. After payment, Stripe will try to call your webhook. If **STRIPE_WEBHOOK_SECRET** is not set or the webhook is not reachable, the order will **not** be marked paid and the confirmation email will **not** be sent. So for a full test you need the webhook (next section).

---

## Local webhook testing (Stripe CLI)

To test “payment → webhook → order marked paid + email” on your machine:

1. **Install Stripe CLI**: https://stripe.com/docs/stripe-cli  
   (e.g. `brew install stripe/stripe-cli/stripe` on macOS.)

2. **Log in and forward webhooks to your API:**
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   The CLI will print a **webhook signing secret** like `whsec_...`.

3. **Put that secret in `.env`:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
   ```
   Restart the API so it picks up the new value.

4. **Run the full flow:**
   - Create an order (registered or guest).
   - Call the same Stripe Checkout endpoint as above and open the returned `url`.
   - Pay with **4242 4242 4242 4242**.
   - The CLI forwards `checkout.session.completed` to your app; the order should be marked paid and the order confirmation email sent (with “Payment Confirmed”).

5. Watch the CLI output to see the forwarded webhook events.

### Trigger the webhook manually (without paying again)

To test that your endpoint correctly marks an order as paid when it receives `checkout.session.completed`:

1. **Stripe CLI must be running** with the same `STRIPE_WEBHOOK_SECRET` in your `.env`:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

2. **Create a guest order** and get its `orderId` (e.g. `AG-2602-28205410-27991`) via the guest order API. Do **not** go through Stripe Checkout for this test.

3. **Send a test event** with that `orderId` in metadata (replace `AG-2602-28205410-27991` and `guest@example.com` with your order’s values):
   ```bash
   stripe trigger checkout.session.completed
   ```
   That sends a **generic** test event; metadata will not match your real order, so `markOrderPaidByStripe` will not find the order.

   To test with **your** order ID you have two options:

   - **Option A – Pay once, then replay:** After doing a real test payment (step 4 in “Local webhook testing” above), in the Stripe CLI run:
     ```bash
     stripe events resend evt_xxxxxxxxxxxxxxxxxxxxxxxx
     ```
     Use the event ID from the CLI output (or from Dashboard → Developers → Events). Your API will receive the same event again; because `markOrderPaidByStripe` is idempotent, the order stays paid and no duplicate email is sent in a harmful way.

   - **Option B – Call your endpoint with a signed payload:** Use the Stripe CLI to build a `checkout.session.completed` payload that includes your `orderId` in `metadata`, then send it to your endpoint. The CLI does not offer a one‑line “trigger with custom metadata” for checkout.session.completed, so the easiest end‑to‑end test is: create order → get Checkout URL → pay with 4242… → let the CLI forward the real event. Then check your DB and email to confirm the order is paid and the confirmation email was sent.

4. **Verify:** After a real payment (or a replayed event that matches an order), check that the order document has `isPaid: true`, `status: 'confirmed'`, and that the customer received the order confirmation email.

---

## Production

1. In Stripe Dashboard → **Developers → Webhooks** add an endpoint:
   - URL: `https://your-api-domain.com/api/webhooks/stripe`
   - Event: **checkout.session.completed**
2. Copy the endpoint’s **Signing secret** and set it as **STRIPE_WEBHOOK_SECRET** in production.
3. Use **live** keys (`sk_live_...`) and set **APP_URL** to your production front-end URL.

---

## cURL examples

Use your API base URL (e.g. `http://localhost:3000` if `PORT=3000`). Replace `ORDER_ID` and `YOUR_FIREBASE_ID_TOKEN` where needed.

### Guest order → Stripe Checkout

**1. Create a guest order** (use a real product ID from your DB):

```bash
curl -s -X POST http://localhost:3000/api/orders/guest \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": "YOUR_PRODUCT_MONGO_ID", "quantity": 1 }
    ],
    "customerInfo": {
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "guest@example.com",
      "phone": "+15551234567"
    },
    "shippingAddress": {
      "street": "123 Main St",
      "city": "Toronto",
      "state": "ON",
      "postalCode": "M5V 1A1",
      "country": "Canada"
    }
  }'
```

From the response, copy the `orderId` (e.g. `AG-2502-07123456-12345`).

**2. Get Stripe Checkout URL** for that order:

```bash
curl -s -X POST http://localhost:3000/api/orders/guest/ORDER_ID/stripe-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"email":"guest@example.com"}'
```

Replace `ORDER_ID` with the value from step 1. The response will contain `"url": "https://checkout.stripe.com/..."`. Open that URL in a browser and pay with test card **4242 4242 4242 4242**.

---

### Registered user order → Stripe Checkout

**1. Create order** (requires Firebase auth):

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json"
```

Copy the `orderId` from the response.

**2. Get Stripe Checkout URL**:

```bash
curl -s -X POST http://localhost:3000/api/orders/ORDER_ID/stripe-checkout-session \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json"
```

Replace `ORDER_ID` and `YOUR_FIREBASE_ID_TOKEN`. Use the returned `url` in the browser to complete payment.

**Getting a Firebase ID token for curl:** The API expects a **Firebase ID token** (from Firebase Auth), not a custom JWT. If you get `401 Invalid Firebase token`:

1. **Test script:** From the project root, run:
   ```bash
   npm run test:firebase-token
   ```
   Add to `.env`: `FIREBASE_WEB_API_KEY` (Firebase Console → Project settings → General → Web API Key), `FIREBASE_TEST_EMAIL`, and `FIREBASE_TEST_PASSWORD` for a user that exists in Firebase Auth and has registered in your app. The script prints the ID token and an example `Authorization: Bearer <token>` line.
2. **From your frontend:** After the user signs in with Firebase (e.g. Email/Password or Google), get the token with `await getAuth().currentUser?.getIdToken()` (or your SDK’s equivalent) and copy it into the `Authorization: Bearer <token>` header. Tokens expire after about an hour, so use a fresh one.
3. **Same Firebase project:** The token must be from the same Firebase project as your `FIREBASE_SERVICE_ACCOUNT_BASE64`. Wrong project or wrong env (test vs prod) will cause "Invalid Firebase token".
4. **User must exist:** The guard also loads the user by Firebase UID. If the user is not in your DB, you’ll get "User not found in database" instead.

---

## Test cards (Stripe test mode)

- Success: **4242 4242 4242 4242**
- Decline: **4000 0000 0000 0002**
- 3D Secure: **4000 0025 0000 3155**

More: https://docs.stripe.com/testing#cards
