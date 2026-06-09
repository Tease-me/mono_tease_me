import {
  composeValidators,
  emailFormat,
  hasLowercase,
  hasNumber,
  hasSpecialChar,
  hasUppercase,
  maxLength,
  minLength,
  phoneFormat,
  required,
  urlFormat,
  Validator,
} from "./validations";

export type ValidationRuleSet = Record<string, Validator<string>>;

export const validationRules = {
  email: composeValidators(required("Email"), emailFormat),
  password: composeValidators(
    required("Password"),
    minLength("Password", 8),
    maxLength("Password", 64),
    hasUppercase("Password"),
    hasLowercase("Password"),
    hasNumber("Password"),
    hasSpecialChar("Password")
  ),
  nickName: composeValidators(required("Nick Name"), minLength("Nick Name", 3), maxLength("Nick Name", 30)),
  username: composeValidators(required("Username"), minLength("Username", 3), maxLength("Username", 30)),
  phone: composeValidators(required("Phone"), phoneFormat),
  url: composeValidators(required("URL"), urlFormat),
  firstName: composeValidators(required("First name"), minLength("First name", 2)),
  lastName: composeValidators(required("Last name"), minLength("Last name", 2)),
};
