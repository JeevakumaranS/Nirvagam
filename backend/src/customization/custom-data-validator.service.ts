import { Injectable, BadRequestException } from '@nestjs/common';
import { FieldValidationRules } from './customization.types';

@Injectable()
export class CustomDataValidatorService {
  /**
   * Validates custom field values against declared field definitions.
   * Rejects unknown fields and enforces type, regex, bounds, and enum checks.
   */
  validate(
    customData: Record<string, any> | undefined | null,
    fieldDefinitions: any[],
    options: { partial?: boolean } = {}
  ): Record<string, any> {
    if (!customData || Object.keys(customData).length === 0) {
      // Check required fields
      if (!options.partial) {
        for (const def of fieldDefinitions) {
          if (def.required && def.status === 'active') {
            throw new BadRequestException(`Field [${def.label || def.field_key}] is required.`);
          }
        }
      }
      return {};
    }

    const fieldMap = new Map<string, any>();
    for (const def of fieldDefinitions) {
      fieldMap.set(def.field_key, def);
    }

    // 1. Reject unknown custom fields (strict schema adherence)
    for (const key of Object.keys(customData)) {
      if (!fieldMap.has(key)) {
        throw new BadRequestException(
          `Unknown custom field "${key}". Unregistered custom fields are rejected.`
        );
      }
    }

    const sanitized: Record<string, any> = {};

    // 2. Validate declared fields
    for (const def of fieldDefinitions) {
      if (def.status !== 'active') continue;

      const rawValue = customData[def.field_key];
      const rules: FieldValidationRules = def.validation || {};

      // Check required
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        if (def.required && !options.partial) {
          throw new BadRequestException(`Field [${def.label || def.field_key}] is required.`);
        }
        continue;
      }

      // Type-specific coercion and validation
      switch (def.datatype) {
        case 'integer': {
          const num = Number(rawValue);
          if (!Number.isInteger(num)) {
            throw new BadRequestException(
              `Field [${def.label}] must be a valid integer. Received: "${rawValue}"`
            );
          }
          if (rules.min !== undefined && num < rules.min) {
            throw new BadRequestException(`Field [${def.label}] must be >= ${rules.min}.`);
          }
          if (rules.max !== undefined && num > rules.max) {
            throw new BadRequestException(`Field [${def.label}] must be <= ${rules.max}.`);
          }
          sanitized[def.field_key] = num;
          break;
        }

        case 'decimal':
        case 'currency': {
          const num = Number(rawValue);
          if (isNaN(num)) {
            throw new BadRequestException(
              `Field [${def.label}] must be a valid numeric amount. Received: "${rawValue}"`
            );
          }
          if (rules.min !== undefined && num < rules.min) {
            throw new BadRequestException(`Field [${def.label}] must be >= ${rules.min}.`);
          }
          if (rules.max !== undefined && num > rules.max) {
            throw new BadRequestException(`Field [${def.label}] must be <= ${rules.max}.`);
          }
          sanitized[def.field_key] = num;
          break;
        }

        case 'boolean': {
          sanitized[def.field_key] = Boolean(rawValue);
          break;
        }

        case 'select': {
          const val = String(rawValue);
          if (rules.options && Array.isArray(rules.options) && rules.options.length > 0) {
            if (!rules.options.includes(val)) {
              throw new BadRequestException(
                `Invalid option "${val}" for [${def.label}]. Allowed: [${rules.options.join(', ')}]`
              );
            }
          }
          sanitized[def.field_key] = val;
          break;
        }

        case 'multi_select': {
          if (!Array.isArray(rawValue)) {
            throw new BadRequestException(`Field [${def.label}] must be an array of selected options.`);
          }
          if (rules.options && Array.isArray(rules.options) && rules.options.length > 0) {
            for (const item of rawValue) {
              if (!rules.options.includes(item)) {
                throw new BadRequestException(
                  `Invalid option "${item}" in [${def.label}]. Allowed: [${rules.options.join(', ')}]`
                );
              }
            }
          }
          sanitized[def.field_key] = rawValue;
          break;
        }

        case 'date':
        case 'datetime': {
          const date = new Date(rawValue);
          if (isNaN(date.getTime())) {
            throw new BadRequestException(
              `Field [${def.label}] must be a valid date/time format. Received: "${rawValue}"`
            );
          }
          sanitized[def.field_key] = date.toISOString();
          break;
        }

        case 'email': {
          const email = String(rawValue).trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            throw new BadRequestException(`Field [${def.label}] must be a valid email address.`);
          }
          sanitized[def.field_key] = email;
          break;
        }

        default: {
          // text, long_text, phone, url, file, lookup
          const str = String(rawValue);
          if (rules.maxLength && str.length > rules.maxLength) {
            throw new BadRequestException(
              `Field [${def.label}] exceeds maximum length of ${rules.maxLength} characters.`
            );
          }
          if (rules.regex) {
            const re = new RegExp(rules.regex);
            if (!re.test(str)) {
              throw new BadRequestException(
                `Field [${def.label}] value does not match required format constraint.`
              );
            }
          }
          sanitized[def.field_key] = str;
          break;
        }
      }
    }

    return sanitized;
  }
}
