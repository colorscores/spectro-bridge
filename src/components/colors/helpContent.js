// Icon-based help content for the Colors feature guide

export const helpContent = [
  {
    name: "Color Tools",
    features: [
      {
        name: "Edit Tool",
        description: "Allows you to modify individual color properties including name, tags, LAB values, and other color specifications. You can edit multiple colors at once by selecting them first.",
        importance: "Essential for maintaining accurate color data and keeping your color library organized. Proper color information ensures consistent color matching and quality control.",
        howToUse: "Select one or more colors, then click the Edit button in the toolbar. Make your changes in the edit dialog and save."
      },
      {
        name: "Tag Tool",
        description: "Assigns descriptive tags to colors for better organization and searching. Tags can represent color families, projects, seasons, or any custom classification system.",
        importance: "Tags make it easy to find specific colors quickly and organize large color libraries. They're crucial for efficient workflow in design and manufacturing.",
        howToUse: "Select colors and click the Tag button. Add, remove, or modify tags as needed. Use the search function to find colors by their tags."
      },
      {
        name: "Change Type",
        description: "Converts colors between master and dependent types. Master colors are standalone references, while dependent colors are linked to master colors for consistency.",
        importance: "Proper color relationships ensure consistency across your color system and help maintain color accuracy when master colors are updated.",
        howToUse: "Select colors and choose 'Change Type' from the toolbar. Select whether to make them master or dependent colors."
      },
      {
        name: "Add to Book",
        description: "Organizes selected colors into color books for better categorization. Color books help group related colors for specific projects, seasons, or collections.",
        importance: "Color books provide structure to large color libraries and make it easier for teams to find and use the right colors for specific purposes.",
        howToUse: "Select colors, click 'Add to Book', then choose an existing book or create a new one."
      },
      {
        name: "Remove Duplicates",
        description: "Identifies and removes duplicate color entries based on color values, helping maintain a clean and efficient color database.",
        importance: "Duplicate colors create confusion and inefficiency. Removing them keeps your color library clean and ensures accurate color counts.",
        howToUse: "Select a range of colors or all colors, then click 'Remove Duplicates'. Review the suggested duplicates before confirming removal."
      },
      {
        name: "Merge Modes",
        description: "Combines different measurement modes for the same color into a single color entry, consolidating multiple readings of the same color.",
        importance: "When the same color is measured multiple times or with different instruments, merging helps maintain a single authoritative color reference.",
        howToUse: "Select colors with multiple measurement modes and click 'Merge Modes'. Choose which measurements to keep as the primary reference."
      },
      {
        name: "Delete",
        description: "Permanently removes selected colors from the color library. This action cannot be undone, so use with caution.",
        importance: "Removing obsolete or incorrect colors keeps your library current and prevents confusion during color selection.",
        howToUse: "Select the colors you want to remove and click the Delete button. Confirm the deletion in the dialog that appears."
      },
      {
        name: "Export",
        description: "Exports selected colors to various file formats including CXF, CGATS, Excel, and others for use in different applications or sharing with partners.",
        importance: "Export functionality enables integration with other systems and allows sharing of color data with suppliers, partners, and customers.",
        howToUse: "Select the colors to export, click Export, choose your desired format and options, then save the file."
      }
    ]
  },
  {
    name: "Search & Filter",
    features: [
      {
        name: "Search Bar",
        description: "Quickly find colors by searching for names, hex codes, color codes, tags, or other color attributes. Supports partial matches and multiple search terms.",
        importance: "Fast color discovery is essential when working with large color libraries. The search bar is often the quickest way to find specific colors.",
        howToUse: "Type any part of a color name, code, or tag in the search box. Results update automatically as you type."
      },
      {
        name: "Advanced Filter",
        description: "Provides complex filtering capabilities with multiple criteria including color ranges, measurement data, creation dates, and custom attributes.",
        importance: "Advanced filtering helps find colors that meet specific technical requirements or belong to particular categories.",
        howToUse: "Click the Advanced Filter button to open the filter panel. Set your criteria and apply filters to narrow down the color list."
      },
      {
        name: "Filter by Tags",
        description: "Quickly filter colors based on their assigned tags. You can filter by single tags or combinations of tags to find specific color groups.",
        importance: "Tag-based filtering is the fastest way to find colors organized by your custom classification system.",
        howToUse: "Use the tag filter dropdown or tag buttons to show only colors with specific tags. Multiple tags can be selected for more precise filtering."
      },
      {
        name: "Filter by Standard Type",
        description: "Filters colors based on whether they are master colors (independent references) or dependent colors (linked to master colors).",
        importance: "Understanding color relationships is crucial for maintaining color consistency and managing color hierarchies.",
        howToUse: "Use the Standard Type filter to show only master colors, only dependent colors, or both types."
      },
      {
        name: "Filter by Date",
        description: "Filters colors based on creation dates, modification dates, or measurement dates to find recently added or updated colors.",
        importance: "Date filtering helps track color library changes and find colors added during specific time periods.",
        howToUse: "Set date ranges in the filter options to show colors created or modified within specific time periods."
      },
      {
        name: "Filter by Owner",
        description: "Filters colors based on the organization or user that owns them, useful for managing shared color libraries.",
        importance: "Owner-based filtering helps manage access control and organization in shared color environments.",
        howToUse: "Select specific owners or organizations from the filter dropdown to see only their colors."
      },
      {
        name: "Filter by Sharing",
        description: "Shows colors based on their sharing status with partners - whether they're shared, not shared, or have specific sharing permissions.",
        importance: "Sharing filters help manage color access and ensure the right colors are available to the right partners.",
        howToUse: "Use sharing status filters to see which colors are currently shared with partners or available for sharing."
      }
    ]
  },
  {
    name: "Color Views",
    features: [
      {
        name: "Flat View",
        description: "Displays all colors in a simple list format without hierarchical grouping. This is the default view that shows all accessible colors in your library.",
        importance: "Flat view provides the quickest overview of your entire color collection and is ideal for searching and bulk operations.",
        howToUse: "Select 'Flat View' from the view options. All colors will be displayed in a scrollable list with basic color information."
      },
      {
        name: "Book View",
        description: "Organizes colors by their assigned color books, creating a hierarchical view where colors are grouped by book categories.",
        importance: "Book view helps you work with organized color collections and makes it easy to focus on specific color groups or projects.",
        howToUse: "Select 'Book View' from the view options. Colors will be grouped under their respective books, which can be expanded or collapsed."
      },
      {
        name: "Dependent View",
        description: "Shows the hierarchical relationship between master and dependent colors, displaying how colors are linked and organized in your color system.",
        importance: "Understanding color dependencies is crucial for maintaining color consistency and managing updates that affect multiple related colors.",
        howToUse: "Select 'Dependent View' to see master colors with their dependent colors grouped underneath in a tree structure."
      },
      {
        name: "Color Detail Pane",
        description: "Provides detailed information about selected colors including full color values, measurement data, history, and related information in a sidebar panel.",
        importance: "Detailed color information is essential for quality control, technical specifications, and understanding color properties.",
        howToUse: "Click on any color to open the detail pane. The sidebar will show comprehensive information about the selected color."
      },
      {
        name: "Selection System",
        description: "Allows you to select multiple colors for batch operations using checkboxes, shift-clicking for ranges, or ctrl-clicking for individual selections.",
        importance: "Multi-selection enables efficient batch operations like editing, tagging, exporting, or organizing multiple colors at once.",
        howToUse: "Click checkboxes to select individual colors, shift-click to select ranges, or use ctrl-click to add colors to your selection."
      },
      {
        name: "Sorting Options",
        description: "Sorts colors by various criteria including name (alphabetical), tags, creation date, modification date, or color values.",
        importance: "Proper sorting helps you find colors quickly and organize your view according to your current workflow needs.",
        howToUse: "Click column headers to sort by that criteria, or use the sort dropdown menu to choose specific sorting options and directions."
      }
    ]
  }
];