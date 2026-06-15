import "express-serve-static-core";

declare global {
  namespace Express {
    interface User {
      claims?: {
        sub?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
      };
      id?: string;
      firstName?: string;
      lastName?: string;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    user?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  }
}

export {};
