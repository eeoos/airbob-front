export interface BrowserConfirmationPort {
  confirm(message: string): boolean;
}

export const browserConfirmation: BrowserConfirmationPort = {
  confirm(message) {
    return window.confirm(message);
  },
};
