import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ name: 'deliveryTimeRange', async: false })
export class DeliveryTimeRangeValidator implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as Record<string, unknown>;
    const minTime = obj.deliveryMinTime as number | undefined;
    const maxTime = obj.deliveryMaxTime as number | undefined;

    // If both min and max are provided, ensure min <= max
    if (minTime !== undefined && maxTime !== undefined) {
      return minTime <= maxTime;
    }

    return true;
  }

  defaultMessage(): string {
    return 'deliveryMaxTime must be greater than or equal to deliveryMinTime';
  }
}

export function IsDeliveryTimeRangeValid(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDeliveryTimeRangeValid',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: DeliveryTimeRangeValidator,
    });
  };
}
