export const docSpec = {
    // Called whenever the XML document changes
    onchange: function () {
        console.log("I have changed now");
    },

    // Called to validate the current document state
    validate: function (obj) {
        console.log("I am validating now");
    },

    // Defines behavior for each XML element type
    elements: {

        // Configuration for <list> elements
        "list": {
            // Context menu items that appear when user right-clicks <list>
            menu: [
                {
                    caption: "Append an <item>",        // Text shown in menu
                    action: x.newElementChild,          // Function to call when clicked
                    actionParameter: "<item/>",         // XML to insert as child
                },
            ],
        },

        // Configuration for <item> elements
        "item": {
            // Context menu items that appear when user right-clicks <item>
            menu: [
                {
                    caption: 'Add @label="something"',           // Menu text
                    action: x.newAttribute,                      // Add attribute function
                    actionParameter: { name: "label", value: "something" }, // Attribute details
                    hideIf: function (jsElement) {               // Hide menu item if condition is true
                        return jsElement.hasAttribute("label");   // Hide if label already exists
                    },
                },
                {
                    caption: "Delete this <item>",     // Menu text
                    action: x.deleteElement,           // Delete current element
                    // No actionParameter needed for delete
                },
                {
                    caption: "New <item> before",      // Menu text
                    action: x.newElementBefore,        // Insert sibling before current element
                    actionParameter: "<item/>",        // XML to insert
                },
                {
                    caption: "New <item> after",       // Menu text
                    action: x.newElementAfter,         // Insert sibling after current element
                    actionParameter: "<item/>",        // XML to insert
                },
            ],

            // Enable drag-and-drop: this element can be dropped into these parent elements
            canDropTo: ["list"],

            // Define attributes that this element can have
            attributes: {
                // Configuration for the "label" attribute
                "label": {
                    asker: x.askString,              // How user edits attribute value (text input)
                    menu: [                          // Context menu for the attribute itself
                        {
                            caption: "Delete this @label",  // Menu text
                            action: x.deleteAttribute,      // Remove this attribute
                        },
                    ],
                },
            },
        },
    },
};
