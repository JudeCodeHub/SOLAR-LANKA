/**
 * Every piece of text the interface shows, in one place, so translations (Sinhala and Tamil
 * are planned) can be added without touching components. Components import `messages` and
 * never write user-facing text inline; ESLint (react/jsx-no-literals) enforces that for JSX.
 *
 * Conventions:
 * - Group by feature. Keep wording short and say what to do next.
 * - Placeholders look like {name}; fill them with format() from ./format.ts.
 * - Counts that change wording use { one, other } objects with plural().
 * - Financial and technical wording needs a reviewed translation, not a machine one.
 */
export const en = {
  app: {
    name: "Solar Lanka",
    description:
      "Explore solar products, estimate your system, compare quotations and track installation. Portfolio demonstration with fictional data.",
  },
  titles: {
    signIn: "Sign in · Solar Lanka",
    signUp: "Create account · Solar Lanka",
    account: "Account · Solar Lanka",
    notFound: "Page not found · Solar Lanka",
    error: "Something went wrong · Solar Lanka",
  },
  a11y: {
    skipToContent: "Skip to main content",
  },
  nav: {
    primaryLabel: "Primary",
    accountLabel: "Account",
    mobileLabel: "Mobile",
    openMenu: "Open menu",
    menuTitle: "Menu",
    menuDescription: "Site navigation and account links",
    groups: {
      explore: "Explore",
      customer: "My activity",
      company: "Company workspace",
      admin: "Administration",
      account: "Account",
    },
    items: {
      home: "Home",
      panels: "Solar panels",
      inverters: "Inverters",
      estimator: "Estimator",
      companies: "Companies",
      learn: "Learning centre",
      troubleshooting: "Troubleshooting",
      support: "Support",
      myEstimates: "My estimates",
      myRequests: "My requests",
      myInstallations: "My installations",
      myFavourites: "Favourites",
      companyInbox: "Request inbox",
      companyOffers: "Product offers",
      companyInstallations: "Installations",
      companyProfile: "Company profile",
      adminCompanies: "Company reviews",
      adminCatalogue: "Catalogue",
      adminEstimator: "Estimator settings",
      adminUsers: "Users",
      adminActivity: "Activity and audit",
      account: "Account",
      notifications: "Notifications",
    },
  },
  auth: {
    signIn: "Sign in",
    createAccount: "Create account",
    signOut: "Sign out",
    customerOnlyNote:
      "New accounts are customer accounts. Company and administrator access is granted separately by the platform and cannot be chosen here.",
  },
  roles: {
    customer: "Customer",
    platform_admin: "Platform administrator",
  },
  home: {
    title: "Solar Lanka",
    tagline: "Explore solar products, estimate your system and compare quotations.",
    note: "Portfolio demonstration under development. All companies, prices and estimates will be fictional samples.",
    catalogueSoon: "Catalogue coming soon",
  },
  services: {
    installation: "Installation",
    maintenance: "Maintenance",
    repair: "Repair",
    battery_installation: "Battery installation",
    site_assessment: "Site assessment",
  },
  landing: {
    hero: {
      title: "Solar Lanka",
      tagline:
        "Explore solar panels and inverters, estimate what a system could produce and cost, and compare quotations from solar companies in Sri Lanka.",
      goToAccount: "Go to your account",
    },
    demoStatus: {
      title: "Demo status",
      body: "This is a portfolio demonstration, not a real marketplace. Every company, price and customer record is a fictional sample, and estimates are planning aids rather than installation designs or guaranteed savings.",
    },
    entry: {
      title: "Start here",
      comingSoon: "Coming soon",
      descriptions: {
        panels: "Browse sample panel specifications and compare up to three side by side.",
        inverters: "Browse sample inverters by type and capacity.",
        estimator: "Estimate system size, yearly generation and a cost range from your electricity use.",
        companies: "Find fictional installers by district and service.",
        learn: "Plain-language guides to solar basics, storage and maintenance.",
        troubleshooting: "Look up manufacturer error codes for supported inverter models.",
        support: "Ask for help with a system or an order.",
      },
    },
    products: {
      panelsTitle: "Solar panels",
      invertersTitle: "Inverters",
      sampleNote: "Sample catalogue entry",
      kind: { panel: "Solar panel", inverter: "Inverter" },
      showing: "Showing {shown} of {total}",
      emptyTitle: "No products yet",
      emptyDescription: "No products have been published to the catalogue yet.",
    },
    companies: {
      title: "Solar companies",
      intro:
        "Fictional companies for this demonstration. A listing means the platform approved the profile; it does not verify registration or qualifications.",
      districts: "Serves",
      services: "Services",
      credentials: "Declared credentials (not verified)",
      credentialLine: "{name}, {issuer}",
      emptyTitle: "No companies yet",
      emptyDescription: "No company profiles have been published yet.",
    },
    unavailable: {
      title: "This section could not be loaded",
      message: "The data is temporarily unavailable. Try again in a moment.",
      retry: "Try again",
    },
  },
  footer: {
    disclaimer:
      "Solar Lanka is a portfolio demonstration. Companies, prices and customer records are fictional samples, and estimates are planning aids, not installation designs or guaranteed savings.",
  },
  account: {
    cardTitle: "Application account",
    cardDescription:
      "Your role and access are decided by the platform, not by your sign-in provider.",
    role: "Role",
    created: "Account created",
  },
  errors: {
    signedOut: {
      title: "Sign in required",
      message: "Your session has ended or you are not signed in. Sign in and try again.",
    },
    forbidden: { title: "Not allowed", message: "You do not have permission to do this." },
    notFound: {
      title: "Not found",
      message: "This item does not exist or is not available to you.",
    },
    conflict: { title: "Cannot be done now" },
    invalidInput: {
      title: "Check your input",
      withIssues: "Some details need attention:",
      withoutIssues: "The request was not accepted. Check what you entered and try again.",
    },
    rateLimited: {
      title: "Too many requests",
      waitSeconds: {
        one: "Please wait {seconds} second and try again.",
        other: "Please wait {seconds} seconds and try again.",
      },
      wait: "Please wait a moment and try again.",
    },
    unavailable: {
      title: "Service unavailable",
      message: "The service is temporarily unavailable. Try again in a moment.",
    },
    unexpected: {
      title: "Something went wrong",
      message: "An unexpected error occurred. Try again, and contact support if it continues.",
    },
    // Technical descriptions carried on ApiError for logs and tests, never shown to users.
    technical: {
      requestFailed: "The request could not be completed.",
      network: "The server could not be reached.",
      unknown: "Something went wrong.",
    },
  },
  session: {
    inactive: {
      title: "Account unavailable",
      message:
        "Your account is suspended or no longer active. If you think this is a mistake, contact the platform administrator.",
      signOut: "Sign out",
    },
    rejected: {
      title: "We could not verify your session",
      message:
        "The application did not accept your sign-in. Try again, or sign out and sign in again.",
      retry: "Try again",
      signInAgain: "Sign out and sign in again",
    },
    chip: {
      inactive: "Account unavailable",
      rejected: "Session problem",
    },
  },
  states: {
    loading: "Loading…",
    retry: "Try again",
    retrying: "Trying again…",
    emptyTitle: "Nothing here yet",
    emptyDescription: "There is nothing to show right now.",
  },
  forms: {
    errorSummaryTitle: "There is a problem",
    errorSummaryIntro: "Fix the following before continuing:",
    optionalMarker: "(optional)",
    saving: "Saving…",
    validation: {
      required: "This field is required.",
      email: "Enter a valid email address.",
      number: "Enter a number.",
      tooShort: { one: "Enter at least {min} character.", other: "Enter at least {min} characters." },
      tooLong: { one: "Enter no more than {max} character.", other: "Enter no more than {max} characters." },
      tooSmall: "Enter a value of {min} or more.",
      tooBig: "Enter a value of {max} or less.",
      invalid: "Enter a valid value.",
    },
  },
  pages: {
    notFound: {
      title: "Page not found",
      message: "The page you asked for does not exist or has moved.",
      home: "Go to the home page",
    },
    error: {
      title: "Something went wrong",
      message: "This page could not be shown. Try again, and contact support if it continues.",
      retry: "Try again",
    },
  },
} as const;

/** The same shape with plain strings, so other languages need not repeat English wording. */
export type DeepString<T> = T extends string
  ? string
  : { -readonly [K in keyof T]: DeepString<T[K]> };

export type Messages = DeepString<typeof en>;
