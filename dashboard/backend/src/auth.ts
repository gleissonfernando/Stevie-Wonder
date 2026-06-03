import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env";

export type AuthUser = {
  id: string;
  username: string;
  avatar?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signSession(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, { expiresIn: "7d" });
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.cookies?.[env.cookieName];

  if (!token) {
    response.status(401).json({ error: "Login Discord obrigatorio." });
    return;
  }

  try {
    request.user = jwt.verify(token, env.jwtSecret) as AuthUser;
    next();
  } catch {
    response.status(401).json({ error: "Sessao invalida." });
  }
}
