// Help content structure for My Company sections

export const myCompanyHelpContent = [
  {
    groupName: "Licensing",
    description: "Manage your organization's feature licenses and subscription plans",
    features: [
      {
        name: "Library License",
        description: "create and share colors across your supply chain",
        whatItDoes: "Libraries allow you to store, organize, and share color standards across your organization. You can create unlimited color collections and maintain version control.",
        whyImportant: "Centralized color management ensures consistency across all your projects and teams. It reduces errors and improves workflow efficiency.",
        howToUse: "Navigate to Colors > Libraries to create new libraries, import existing standards, or share collections with team members.",
        levels: ["Free - 20 colors, 1 partner", "Basic - 1000 colors, 20 partners", "Pro - 10000 colors, 200 partners"]
      },
      {
        name: "Printer Kiosk License",
        description: "Interactive color matching and approval workflow",
        whatItDoes: "Printer Kiosk provides an interactive interface for print operators to match colors, approve standards, and manage print workflows in real-time.",
        whyImportant: "Streamlines the print approval process and reduces color matching errors. Improves communication between designers and print operators.",
        howToUse: "Set up kiosk stations in your print facility. Print operators can scan colors, compare to standards, and approve jobs directly from the interface.",
        levels: ["Basic: 1 kiosk station", "Pro: 5 kiosk stations", "Enterprise: Unlimited stations"]
      },
      {
        name: "Match Pack License",
        description: "Advanced color matching and formulation tools",
        whatItDoes: "Match Pack provides sophisticated color matching algorithms, ink formulation recipes, and substrate correction tools for precise color reproduction.",
        whyImportant: "Enables accurate color matching across different substrates and printing conditions. Reduces waste and improves color consistency.",
        howToUse: "Access Match Pack from the Colors menu. Select target colors, choose substrates, and generate formulation recipes automatically.",
        levels: ["Match Pack Licenses are available in packs of 5."]
      },
      {
        name: "Create Pack",
        description: "Design and creation tools for custom color standards",
        whatItDoes: "Create Pack offers tools for designing custom color palettes, creating branded color collections, and developing new color standards from scratch.",
        whyImportant: "Empowers your team to create original color content and maintain brand consistency across all materials and channels.",
        howToUse: "Use Create Pack to build custom palettes, import colors from various sources, and export standards in multiple formats.",
        levels: ["Basic: Standard tools", "Pro: Advanced design features", "Studio: Full creative suite"]
      }
    ]
  },
  {
    groupName: "Sharing Tags",
    description: "Organize and categorize content for easy discovery and sharing",
    features: [
      {
        name: "Categories",
        description: "High-level groupings for organizing your content",
        whatItDoes: "Categories provide the top-level organization structure for all your shared content. They help users quickly navigate to the type of content they need.",
        whyImportant: "Well-organized categories make it easier for team members to find and use the right content. This improves workflow efficiency and reduces duplication.",
        howToUse: "Create categories that match your workflow (e.g., 'Product Lines', 'Seasons', 'Projects'). Keep category names clear and intuitive."
      },
      {
        name: "Tags",
        description: "Detailed labels for specific content attributes",
        whatItDoes: "Tags provide detailed, searchable labels that describe specific attributes of your content. Multiple tags can be applied to the same item.",
        whyImportant: "Tags enable powerful search and filtering capabilities. They help users find exactly what they need quickly and accurately.",
        howToUse: "Apply relevant tags to all shared content. Use consistent naming conventions and avoid creating duplicate tags with similar meanings."
      }
    ]
  },
  {
    groupName: "Default Color Settings",
    description: "Configure measurement standards for consistent color evaluation",
    features: [
      {
        name: "Mode",
        description: "Measurement geometry and illumination conditions",
        whatItDoes: "Mode determines how the spectrophotometer illuminates and measures color samples. Different modes (M0, M1, M2, M3) provide different levels of UV inclusion.",
        whyImportant: "Consistent measurement mode ensures all color evaluations use the same conditions, improving accuracy and repeatability across your organization.",
        howToUse: "Choose M1 for most print applications, M0 for legacy compatibility, M2 for UV-excluded measurements, and M3 for polarized measurements.",
        options: ["M0: Total illumination", "M1: UV-filtered (D50)", "M2: UV-excluded", "M3: Polarized illumination"]
      },
      {
        name: "Illuminant",
        description: "Light source specification for color calculations",
        whatItDoes: "Illuminant defines the spectral characteristics of the light source used for color calculations. Common options include D50, D65, and A.",
        whyImportant: "Different illuminants can significantly affect color appearance. Standardizing on one illuminant ensures consistent color evaluation.",
        howToUse: "Use D50 for graphic arts, D65 for general applications, or A for incandescent lighting conditions. Match your actual viewing conditions.",
        options: ["D50: Daylight 5000K", "D65: Daylight 6500K", "A: Incandescent", "F2: Cool white fluorescent"]
      },
      {
        name: "Observer",
        description: "Standard observer angle for color calculations",
        whatItDoes: "Observer angle defines the field of view used for color calculations. The 2° observer represents central vision, while 10° includes peripheral vision.",
        whyImportant: "Observer angle affects color difference calculations. Using a consistent observer ensures reliable color matching and quality control.",
        howToUse: "Use 2° observer for small samples and critical color matching. Use 10° observer for large area evaluations and general quality control.",
        options: ["2°: Standard observer (1931)", "10°: Supplementary observer (1964)"]
      },
      {
        name: "Table",
        description: "ASTM calculation table for tristimulus values",
        whatItDoes: "ASTM tables define the wavelength intervals and weighting functions used for calculating tristimulus values from spectral data.",
        whyImportant: "Different tables can affect color calculations. Using a consistent table ensures all measurements are calculated the same way.",
        howToUse: "Table 5 (10nm intervals) is most common for graphic arts. Table 6 (5nm intervals) provides higher precision for critical applications.",
        options: ["Table 5: 10nm intervals", "Table 6: 5nm intervals", "Table 7: 20nm intervals"]
      },
      {
        name: "ΔE Method",
        description: "Color difference calculation formula",
        whatItDoes: "ΔE method determines how color differences are calculated and expressed. Different formulas weight lightness, chroma, and hue differently.",
        whyImportant: "The ΔE method affects how color tolerances are interpreted. Modern formulas like ΔE2000 provide better correlation with visual perception.",
        howToUse: "Use ΔE2000 for most applications as it best matches visual perception. Use ΔE76 for legacy compatibility or specific industry requirements.",
        options: ["ΔE2000: Perceptually uniform", "ΔE94: Industry standard", "ΔE76: Legacy CIE formula", "ΔEcmc: Textile industry"]
      }
    ]
  },
  {
    groupName: "Organization Roles",
    description: "Define your organization's role in the supply chain",
    features: [
      {
        name: "Available Role Types",
        description: "Select the roles that best describe your organization",
        whatItDoes: "Organization roles help categorize your company within the print and packaging supply chain. This affects available features and default settings.",
        whyImportant: "Proper role selection ensures you get the most relevant features and workflow options for your specific business needs.",
        howToUse: "Select all roles that apply to your organization. You can choose multiple roles if your company operates in different areas of the supply chain.",
        options: [
          "Brand Owner: Companies that own product brands",
          "Print Supplier: Commercial printing companies", 
          "Premedia Agency: Design and prepress services",
          "Design Agency: Creative and design services",
          "Vendor: Equipment or material suppliers",
          "Ink Supplier: Ink and coating manufacturers"
        ]
      }
    ]
  },
  {
    groupName: "Locations",
    description: "Manage your organization's physical locations and facilities",
    features: [
      {
        name: "Location Management",
        description: "Add, edit, and organize your facilities",
        whatItDoes: "Location management allows you to define and organize all your physical facilities, production sites, and offices within the system.",
        whyImportant: "Proper location setup enables location-specific workflows, reporting, and resource management. It's essential for multi-site organizations.",
        howToUse: "Add each of your facilities with complete address information. Organize locations by type (production, office, warehouse) for better management.",
        operations: [
          "Add Location: Create new facility entries",
          "Edit Location: Update facility information", 
          "Delete Location: Remove unused facilities",
          "Location Types: Categorize by function"
        ]
      }
    ]
  }
];