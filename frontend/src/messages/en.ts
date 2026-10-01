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
    product: "{name} · Solar Lanka",
    favourites: "Favourites · Solar Lanka",
    comparePanels: "Compare solar panels · Solar Lanka",
    compareInverters: "Compare inverters · Solar Lanka",
    panels: "Solar panels · Solar Lanka",
    inverters: "Inverters · Solar Lanka",
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
  catalogue: {
    panels: {
      title: "Solar panels",
      intro:
        "Sample panel entries from the demonstration catalogue. Search by brand or model and narrow by power and efficiency.",
      resultsNoun: "solar panels",
    },
    inverters: {
      title: "Inverters",
      intro:
        "Sample inverter entries from the demonstration catalogue. Search by brand or model and narrow by type and capacity.",
      resultsNoun: "inverters",
    },
    filters: {
      heading: "Filters",
      label: "Search and filter",
      search: "Search brand or model",
      searchPlaceholder: "For example Trina or GW10K",
      minPower: "Minimum power (W)",
      maxPower: "Maximum power (W)",
      minEfficiency: "Minimum efficiency (%)",
      type: "Type",
      typeAny: "Any type",
      typeOptions: { on_grid: "On-grid", off_grid: "Off-grid", hybrid: "Hybrid" },
      minCapacity: "Minimum capacity (kW)",
      maxCapacity: "Maximum capacity (kW)",
      apply: "Apply filters",
      clear: "Clear all filters",
    },
    errors: {
      rangeOrder: "The maximum must not be less than the minimum.",
      invalidIgnored: "A filter value was not valid and has not been applied.",
    },
    results: {
      heading: "Results",
      showing: "Showing {from} to {to} of {total} {noun}",
      none: "No {noun} match these filters.",
      noneTitle: "No matches",
      noneHelp: "Try removing a filter or searching for a different name.",
      empty: "There are no {noun} in the catalogue yet.",
      viewAll: "View all {noun}",
    },
    card: {
      power: "Power",
      efficiency: "Efficiency",
      type: "Type",
      capacity: "Capacity",
      unspecified: "Not specified",
      units: { w: "{value} W", percent: "{value} %", kw: "{value} kW" },
    },
    pagination: {
      label: "Pagination",
      previous: "Previous",
      next: "Next",
      page: "Page {page}",
      goTo: "Go to page {page}",
      ellipsis: "…",
    },
  },
  favourites: {
    save: "Save {name} to favourites",
    signInToSave: "Sign in to save {name} to favourites",
    saved: "{name} saved to favourites.",
    removed: "{name} removed from favourites.",
    limit: "You can save up to {max} favourites. Remove one to add another.",
    failed: "Could not update favourites.",
    page: {
      title: "Favourites",
      intro: "Products you have saved. They are kept with your account, so they are here on any device.",
      showing: "Showing {from} to {to} of {total} favourites",
      emptyTitle: "No favourites yet",
      emptyDescription: "Use the heart on a product to save it here.",
      browsePanels: "Browse solar panels",
      browseInverters: "Browse inverters",
      remove: "Remove {name} from favourites",
    },
  },
  compare: {
    panels: {
      title: "Compare solar panels",
      intro:
        "Up to three solar panels side by side. Every value keeps its unit, and \u201cNot specified\u201d means the catalogue does not hold the value.",
    },
    inverters: {
      title: "Compare inverters",
      intro:
        "Up to three inverters side by side. Every value keeps its unit, and \u201cNot specified\u201d means the catalogue does not hold the value.",
    },
    needTwoTitle: "Choose at least two products to compare",
    needTwoHelp: "Tick Compare on products in the list, then open the comparison from the tray at the bottom of the page.",
    ignored: {
      one: "{count} item in the address could not be used and was ignored.",
      other: "{count} items in the address could not be used and were ignored.",
    },
    tableLabel: "Comparison table. Scroll sideways on a small screen.",
    caption: "Specifications of the selected products, side by side",
    property: "Property",
    unavailable: "No longer available",
    unavailableNote: "This product is no longer in the catalogue, so it cannot be compared.",
    remove: "Remove {name} from this comparison",
    removeShort: "Remove",
    shareNote: "The products are in this page\u2019s address, so you can share the link.",
    sections: { source: "Source and verification" },
    rows: { source: "Source", verified: "Last verified" },
    noSource: "No source recorded",
    openSource: "Open source",
  },
  tray: {
    label: "Product comparison",
    heading: { panel: "Compare solar panels", inverter: "Compare inverters" },
    count: "{count} of {max} selected",
    compareNow: "Compare now",
    needMore: "Select at least {min} to compare",
    clear: "Clear",
    remove: "Remove {name} from comparison",
    loadingName: "Loading\u2026",
    unavailableItem: "Product no longer available",
    nameFailed: "Name could not be loaded",
  },
  toggle: {
    label: "Compare",
    labelFor: "Compare {name}",
    added: "{name} added to the comparison, {count} of {max} selected.",
    removed: "{name} removed from the comparison.",
    full: "The comparison is full ({max} products at most). Remove one to add another.",
    fullHint: "Comparison full",
  },
  detail: {
    back: { panel: "Back to solar panels", inverter: "Back to inverters" },
    notFound: {
      title: "Product not found",
      message: "This product does not exist, has been retired, or the address is not valid.",
    },
    specs: {
      title: "Specifications",
      unspecifiedNote:
        "\u201cNot specified\u201d means the catalogue does not hold this value. It does not mean zero, and it does not mean the product lacks the feature.",
      summary: "{unspecified} of {total} specifications are not specified.",
      summaryNone: "Every listed specification has a value.",
      caption: "{group}: specifications and their values",
      property: "Property",
      value: "Value",
      groups: {
        electrical: "Electrical",
        construction: "Construction",
        warranty: "Warranty",
        capacity: "Type and capacity",
        connectivity: "Connectivity",
        compatibility: "Compatibility",
      },
      labels: {
        wattage: "Rated power",
        efficiency: "Module efficiency",
        voltageMaxPower: "Voltage at maximum power",
        openCircuitVoltage: "Open-circuit voltage",
        currentMaxPower: "Current at maximum power",
        shortCircuitCurrent: "Short-circuit current",
        cellType: "Cell type",
        country: "Country of manufacture",
        productWarranty: "Product warranty",
        performanceWarranty: "Performance warranty",
        warrantyDetails: "Warranty details",
        category: "Inverter type",
        capacity: "Rated capacity",
        mppt: "MPPT inputs",
        connectivity: "Connectivity",
        warranty: "Warranty",
        compatibilityNotes: "Compatibility notes",
      },
      units: {
        w: "{value} W",
        percent: "{value} %",
        v: "{value} V",
        a: "{value} A",
        kw: "{value} kW",
        count: "{value}",
        years: { one: "{value} year", other: "{value} years" },
      },
      compatibilityWarning:
        "Battery and system compatibility is never inferred from capacity. Check the source and the manufacturer before combining equipment.",
    },
    source: {
      title: "Source and verification",
      intro:
        "Specifications come from the manufacturer's documentation where a source is listed. Check the source before relying on a value.",
      source: "Source",
      verified: "Last verified",
      noSource: "No source has been recorded for these specifications.",
      notVerified: "Not recorded",
      open: "Open source",
    },
    documents: {
      title: "Documents",
      none: "No documents have been attached to this product.",
      opensNewTab: "(opens in a new tab)",
      groups: {
        datasheets: "Datasheets",
        manuals: "Manuals",
        manufacturer: "Manufacturer documents",
        errorCodes: "Error code references",
        compatibility: "Compatibility source",
      },
    },
    offers: {
      title: "Sample offers",
      intro:
        "Offers from companies listed on the platform. Prices are demonstration samples, not live market prices, and a company's claim is its own statement, not verified by the platform.",
      none: "No company has listed an offer for this product yet.",
      price: "Indicative price",
      priceFormat: "{currency} {amount}",
      noPrice: "No price given",
      sample: "Sample price",
      claim: "Company claim (not verified)",
      noClaim: "No claim given",
    },
    images: { alt: "Photo of {name}" },
    sampleEntry: "Sample catalogue entry",
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
