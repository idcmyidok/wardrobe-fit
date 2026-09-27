export const AUTH_MESSAGES = {
  notConfigured: "인증 서버가 아직 연결되지 않았습니다. 미리보기 모드에서는 로그인 없이 둘러볼 수 있습니다.",
  invalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  emailNotConfirmed: "이메일 인증이 아직 끝나지 않았습니다. 가입 때 받은 메일의 링크를 열어 주세요.",
  rateLimited: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  weakPassword: "더 안전한 비밀번호를 사용해 주세요. 흔하거나 유출된 적 있는 비밀번호는 쓸 수 없습니다.",
  samePassword: "지금 비밀번호와 다른 비밀번호를 입력해 주세요.",
  unknown: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  suspended: "이용이 정지된 계정입니다.",
  expiredLink: "링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요.",
} as const;
