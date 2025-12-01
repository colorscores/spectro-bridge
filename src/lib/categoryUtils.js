export const buildCategoryTree = (categories) => {
    const categoryMap = new Map(categories.map(c => [String(c.id), { ...c, children: [] }]));
    const tree = [];
    categoryMap.forEach(category => {
        if (category.parent_id && categoryMap.has(String(category.parent_id))) {
            const parent = categoryMap.get(String(category.parent_id));
            if(parent) {
                parent.children.push(category);
            }
        } else {
            tree.push(category);
        }
    });
    return tree;
};

export const flattenCategoryTree = (tree, level = 0) => {
    let flattened = [];
    tree.forEach(category => {
        flattened.push({ ...category, level });
        if (category.children.length > 0) {
            flattened = flattened.concat(flattenCategoryTree(category.children, level + 1));
        }
    });
    return flattened;
};

export const buildCategoryHierarchy = (categories) => {
    if (!categories || categories.length === 0) {
        return [];
    }
    const tree = buildCategoryTree(categories);
    return flattenCategoryTree(tree);
};

export const getDescendantIds = (categoryId, categoryTree) => {
    let descendants = [];
    const findCategory = (nodes, id) => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findCategory(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const categoryNode = findCategory(categoryTree, categoryId);

    const collectIds = (node) => {
        if (!node || !node.children) return;
        node.children.forEach(child => {
            descendants.push(child.id);
            collectIds(child);
        });
    };

    collectIds(categoryNode);
    return descendants;
};