import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, emailOTP } from "better-auth/plugins";
import { Role, UserStatus } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { mailService } from "./mail/mail.service";
import { prisma } from "./prisma";

export const auth = betterAuth({
  baseURL: envVars.BETTER_AUTH_URL,
  secret: envVars.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: Role.CUSTOMER,
      },
      status: {
        type: "string",
        required: true,
        defaultValue: UserStatus.ACTIVE,
      },
      needPasswordChange: {
        type: "boolean",
        required: true,
        defaultValue: false,
      },
      isDeleted: {
        type: "boolean",
        required: true,
        defaultValue: false,
      },
      deletedAt: {
        type: "date",
        required: false,
        defaultValue: null,
      },
      phone: {
        type: "string",
        required: false,
      },
      tenantId: {
        type: "string",
        required: false,
      },
      isOwner: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      isSuperAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      createdById: {
        type: "string",
        required: false,
      },
      lastLoginAt: {
        type: "date",
        required: false,
      },
      lastLoginIp: {
        type: "string",
        required: false,
      },
    },
  },

  plugins: [
    bearer(),
    emailOTP({
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) return;

        if (user.role === Role.SUPER_ADMIN) return;

        if (type === "email-verification" && !user.emailVerified) {
          await mailService.sendEmail({
            to: email,
            subject: "Verify your email",
            templateName: "emails/auth/otp",
            templateData: { name: user.name, otp },
          });
        } else if (type === "forget-password") {
          await mailService.sendEmail({
            to: email,
            subject: "Password Reset OTP",
            templateName: "emails/auth/otp",
            templateData: { name: user.name, otp },
          });
        }
      },
      expiresIn: 2 * 60,
      otpLength: 6,
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24,
    },
  },

  trustedOrigins: [
    envVars.BETTER_AUTH_URL,
    envVars.CLIENT_URL,
    envVars.VENDOR_CLIENT_URL,
    envVars.ADMIN_CLIENT_URL,
  ],

  advanced: {
    useSecureCookies: envVars.NODE_ENV === "production",
    cookies: {
      sessionToken: {
        attributes: {
          sameSite: "lax",
          secure: envVars.NODE_ENV === "production",
          httpOnly: true,
          path: "/",
        },
      },
    },
  },
});
