export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidEmailError extends DomainError {
  readonly code = 'invalid_email';
}

export class InvalidPhoneNumberError extends DomainError {
  readonly code = 'invalid_phone';
}

export type PasswordRejection = 'too_short' | 'needs_uppercase' | 'needs_special';

export class InvalidPasswordError extends DomainError {
  readonly code: `password_${PasswordRejection}`;

  constructor(reason: PasswordRejection) {
    super(`Password rejected: ${reason}`);
    this.code = `password_${reason}`;
  }
}

export class InvalidVerificationCodeError extends DomainError {
  readonly code = 'invalid_verification_code';
}

export class InvalidBarNumberError extends DomainError {
  readonly code = 'invalid_bar_number';
}

export class InvalidConversationTitleError extends DomainError {
  readonly code = 'invalid_conversation_title';
}

export class InvalidArticleReferenceError extends DomainError {
  readonly code = 'invalid_article_reference';
}

export class InvalidAttachmentError extends DomainError {
  readonly code: 'attachment_type_not_allowed' | 'attachment_empty' | 'attachment_too_large';

  constructor(reason: 'type' | 'empty' | 'size') {
    super(`Attachment rejected: ${reason}`);
    this.code =
      reason === 'type'
        ? 'attachment_type_not_allowed'
        : reason === 'empty'
          ? 'attachment_empty'
          : 'attachment_too_large';
  }
}

export class EmptyMessageError extends DomainError {
  readonly code = 'message_empty';
}
