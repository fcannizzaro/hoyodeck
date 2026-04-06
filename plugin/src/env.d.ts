/// <reference types="@fcannizzaro/streamdeck-react/font" />

declare module "*.css?inline" {
  const content: string;
  export default content;
}

declare const __DEBUG__: boolean;
declare const __CODE_SERVER_URL__: string;
