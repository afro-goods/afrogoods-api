import dayjs from 'dayjs';

export const generateOrderId = (): string => {
  const random = Math.floor(10000 + Math.random() * 90000);

  const timestamp = dayjs().format('YYMM-DDHHmmss');

  return `AG-${timestamp}-${random}`;
};
