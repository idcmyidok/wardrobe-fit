export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "wf-theme";

/**
 * <head>에서 먼저 실행해 첫 화면부터 저장된 테마를 적용한다(깜빡임 방지).
 * 저장값이 없거나 system이면 기기 설정을 따른다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;
