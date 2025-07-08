const Xonomy = {
	lang: "", //"en"|"de"|fr"| ...
	mode: "nerd", //"nerd"|"laic"
};
Xonomy.setMode = function (mode) {
	if (mode == "nerd" || mode == "laic") Xonomy.mode = mode;
	const xonomyElements = document.querySelectorAll('.xonomy');
	xonomyElements.forEach(el => {
		if (mode == "nerd") {
			el.classList.remove('laic');
			el.classList.add('nerd');
		}
		if (mode == "laic") {
			el.classList.remove('nerd');
			el.classList.add('laic');
		}
	});
}

Xonomy.jsEscape = function (str) {
	return String(str)
		.replace(/\"/g, '\\\"')
		.replace(/\'/g, '\\\'')
};
Xonomy.xmlEscape = function (str, jsEscape) {
	if (jsEscape) str = Xonomy.jsEscape(str);
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
};
Xonomy.xmlUnscape = function (value) {
	return String(value)
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
};
Xonomy.isNamespaceDeclaration = function (attributeName) {
	if (!attributeName || typeof attributeName !== 'string') {
		return false;
	}
	return attributeName === "xmlns" || attributeName.startsWith("xmlns:");
};
Xonomy.namespaces = {}; //eg. "xmlns:mbm": "http://lexonista.com"

Xonomy.xml2js = function (xml, jsParent) {
	try {
		if (typeof xml === "string") {
			xml = (new window.DOMParser()).parseFromString(xml, "application/xml");
			const parserError = xml.getElementsByTagName("parsererror");
			if (parserError.length > 0) {
				throw new Error("XML parsing failed: " + parserError[0].textContent);
			}
		}

		if (!xml) {
			throw new Error("Invalid XML input");
		}

		if (xml.documentElement) xml = xml.documentElement;

		const js = new Xonomy.surrogate(jsParent);
		js.type = "element";
		js.name = xml.nodeName;
		js.htmlID = "";
		js.attributes = [];
		js.children = [];

		const createParentFunction = (parentRef) => () => parentRef;

		// Process attributes
		Array.from(xml.attributes).forEach(attr => {
			if (!Xonomy.isNamespaceDeclaration(attr.nodeName)) {
				if (attr.name !== "xml:space") {
					js.attributes.push({
						type: "attribute",
						name: attr.nodeName,
						value: attr.value,
						htmlID: "",
						parent: createParentFunction(js)
					});
				}
			} else {
				Xonomy.namespaces[attr.nodeName] = attr.value;
			}
		});

		// Process child nodes
		Array.from(xml.childNodes).forEach(child => {
			switch (child.nodeType) {
				case Node.ELEMENT_NODE:
					js.children.push(Xonomy.xml2js(child, js));
					break;
				case Node.TEXT_NODE:
					if (child.nodeValue.trim()) {
						js.children.push({
							type: "text",
							value: child.nodeValue,
							htmlID: "",
							parent: createParentFunction(js)
						});
					}
					break;
			}
		});

		return Xonomy.enrichElement(js);

	} catch (error) {
		console.error("Xonomy.xml2js error:", error);
		return null;
	}
};

Xonomy.js2xml = function (js) {
	if (js.type == "text") {
		return Xonomy.xmlEscape(js.value);
	} else if (js.type == "attribute") {
		return `${js.name}='${Xonomy.xmlEscape(js.value)}'`;
	} else if (js.type == "element") {
		let xml = `<${js.name}`;
		for (let i = 0; i < js.attributes.length; i++) {
			const att = js.attributes[i];
			xml += ` ${att.name}='${Xonomy.xmlEscape(att.value)}'`;
		}
		if (js.children.length > 0) {
			let hasText = false;
			for (let i = 0; i < js.children.length; i++) {
				let child = js.children[i];
				if (child.type == "text") hasText = true;
			}
			if (hasText) xml += " xml:space='preserve'";
			xml += ">";
			for (const child of js.children) {
				if (child.type == "text") xml += Xonomy.xmlEscape(child.value); //text node
				else if (child.type == "element") xml += Xonomy.js2xml(child); //element node
			}
			xml += `</${js.name}>`;
		} else {
			xml += "/>";
		}
		return xml;
	}
};
Xonomy.enrichElement = function (jsElement) {
	jsElement.hasAttribute = function (name) {
		for (const attribute of this.attributes) {
			if (attribute.name == name) return true;
		}
		return false;
	};
	jsElement.getAttribute = function (name) {
		let ret = null;
		for (const attribute of this.attributes) {
			if (attribute.name == name) ret = attribute;
		}
		return ret;
	};
	jsElement.getAttributeValue = function (name, ifNull) {
		let ret = ifNull;
		for (const attribute of this.attributes) {
			if (attribute.name == name) ret = attribute.value;
		}
		return ret;
	};
	jsElement.hasChildElement = function (name) {
		for (const child of this.children) {
			if (child.name == name) return true;
		}
		return false;
	};
	jsElement.getChildElements = function (name) {
		const ret = [];
		for (const child of this.children) {
			if (child.type == "element" && child.name == name) ret.push(child);
		}
		return ret;
	};
	jsElement.getDescendantElements = function (name) {
		const ret = [];
		for (const child of this.children) {
			if (child.type == "element") {
				if (child.name == name) ret.push(child);
				const temp = child.getDescendantElements(name);
				for (const t of temp) ret.push(t);
			}
		}
		return ret;
	};
	jsElement.getText = function () {
		let txt = "";
		for (const child of this.children) {
			if (child.type == "text") txt += child.value;
			else if (child.type == "element") txt += child.getText();
		}
		return txt;
	};
	jsElement.hasElements = function () {
		for (const child of this.children) {
			if (child.type == "element") return true;
		}
		return false;
	};
	jsElement.getPrecedingSibling = function () {
		const parent = this.parent();
		if (parent) {
			let lastSibling = null;
			for (const sibling of parent.children) {
				if (sibling.type == "element" && sibling.htmlID != this.htmlID) {
					lastSibling = sibling;
				} else if (sibling.htmlID == this.htmlID) {
					return lastSibling;
				}
			}
		}
		return null;
	};
	jsElement.getFollowingSibling = function () {
		const parent = this.parent();
		if (parent) {
			let seenSelf = false;
			for (const sibling of parent.children) {
				if (sibling.htmlID == this.htmlID) {
					seenSelf = true;
				} else if (sibling.type == "element" && seenSelf) {
					return sibling;
				}
			}
		}
		return null;
	};
	jsElement.setAttribute = function (name, value) {
		if (this.hasAttribute(name)) {
			this.getAttribute(name).value = value;
		} else {
			this.attributes.push({
				type: "attribute",
				name,
				value,
				htmlID: null,
				parent: function () { return this; }
			});
		}
	};
	jsElement.addText = function (txt) {
		this.children.push({
			type: "text",
			value: txt,
			htmlID: null,
			parent: function () { return this; }
		});
	};
	return jsElement;
};

Xonomy.verifyDocSpec = function () { //make sure the docSpec object has everything it needs
	if (!Xonomy.docSpec || typeof (Xonomy.docSpec) != "object") Xonomy.docSpec = {};
	if (!Xonomy.docSpec.elements || typeof (Xonomy.docSpec.elements) != "object") Xonomy.docSpec.elements = {};
	if (!Xonomy.docSpec.onchange || typeof (Xonomy.docSpec.onchange) != "function") Xonomy.docSpec.onchange = function () { };
	if (!Xonomy.docSpec.validate || typeof (Xonomy.docSpec.validate) != "function") Xonomy.docSpec.validate = function () { };
};
Xonomy.asFunction = function (specProperty, defaultValue) {
	if (typeof (specProperty) == "function")
		return specProperty;
	else if (typeof (specProperty) == typeof (defaultValue))
		return function () { return specProperty; }
	else
		return function () { return defaultValue };
}
Xonomy.verifyDocSpecElement = function (name) { //make sure the DocSpec object has such an element, that the element has everything it needs
	if (!Xonomy.docSpec.elements[name] || typeof (Xonomy.docSpec.elements[name]) != "object") {
		if (Xonomy.docSpec.unknownElement) {
			Xonomy.docSpec.elements[name] = (typeof (Xonomy.docSpec.unknownElement) === "function")
				? Xonomy.docSpec.unknownElement(name)
				: Xonomy.docSpec.unknownElement;
		}
		else Xonomy.docSpec.elements[name] = {};
	}
	const spec = Xonomy.docSpec.elements[name];
	if (!spec.attributes || typeof (spec.attributes) != "object") spec.attributes = {};
	if (!spec.menu || typeof (spec.menu) != "object") spec.menu = [];
	if (!spec.inlineMenu || typeof (spec.inlineMenu) != "object") spec.inlineMenu = [];
	if (!spec.canDropTo || typeof (spec.canDropTo) != "object") spec.canDropTo = [];
	//if(!spec.mustBeAfter || typeof(spec.mustBeAfter)!="object") spec.mustBeAfter=[];
	//if(!spec.mustBeBefore || typeof(spec.mustBeBefore)!="object") spec.mustBeBefore=[];
	spec.mustBeAfter = Xonomy.asFunction(spec.mustBeAfter, []);
	spec.mustBeBefore = Xonomy.asFunction(spec.mustBeBefore, []);
	spec.oneliner = Xonomy.asFunction(spec.oneliner, false);
	spec.hasText = Xonomy.asFunction(spec.hasText, false);
	spec.collapsible = Xonomy.asFunction(spec.collapsible, true);
	spec.collapsed = Xonomy.asFunction(spec.collapsed, false);
	spec.localDropOnly = Xonomy.asFunction(spec.localDropOnly, false);
	spec.isReadOnly = Xonomy.asFunction(spec.isReadOnly, false);
	spec.isInvisible = Xonomy.asFunction(spec.isInvisible, false);
	spec.backgroundColour = Xonomy.asFunction(spec.backgroundColour, "");
	if (spec.displayName) spec.displayName = Xonomy.asFunction(spec.displayName, "");
	if (spec.title) spec.title = Xonomy.asFunction(spec.title, "");
	for (var i = 0; i < spec.menu.length; i++) Xonomy.verifyDocSpecMenuItem(spec.menu[i]);
	for (var i = 0; i < spec.inlineMenu.length; i++) Xonomy.verifyDocSpecMenuItem(spec.inlineMenu[i]);
	for (const attributeName in spec.attributes) Xonomy.verifyDocSpecAttribute(name, attributeName);
	spec.askerParameter = Xonomy.asFunction(spec.askerParameter, null);
	spec.prominentChildren = Xonomy.asFunction(spec.prominentChildren, []);
};
Xonomy.verifyDocSpecAttribute = function (elementName, attributeName) { //make sure the DocSpec object has such an attribute, that the attribute has everything it needs
	const elSpec = Xonomy.docSpec.elements[elementName];
	if (!elSpec.attributes[attributeName] || typeof (elSpec.attributes[attributeName]) != "object") {
		if (Xonomy.docSpec.unknownAttribute) {
			elSpec.attributes[attributeName] = (typeof (Xonomy.docSpec.unknownAttribute) === "function")
				? Xonomy.docSpec.unknownAttribute(elementName, attributeName)
				: Xonomy.docSpec.unknownAttribute;
		}
		else elSpec.attributes[attributeName] = {};
	}
	const spec = elSpec.attributes[attributeName];
	if (!spec.asker || typeof (spec.asker) != "function") spec.asker = function () { return "" };
	spec.askerParameter = Xonomy.asFunction(spec.askerParameter, null);
	if (!spec.menu || typeof (spec.menu) != "object") spec.menu = [];
	spec.isReadOnly = Xonomy.asFunction(spec.isReadOnly, false);
	spec.isInvisible = Xonomy.asFunction(spec.isInvisible, false);
	spec.shy = Xonomy.asFunction(spec.shy, false);
	if (spec.displayName) spec.displayName = Xonomy.asFunction(spec.displayName, "");
	if (spec.title) spec.title = Xonomy.asFunction(spec.title, "");
	for (let i = 0; i < spec.menu.length; i++) Xonomy.verifyDocSpecMenuItem(spec.menu[i]);
};
Xonomy.verifyDocSpecMenuItem = function (menuItem) { //make sure the menu item has all it needs
	menuItem.caption = Xonomy.asFunction(menuItem.caption, "?");
	if (!menuItem.action || typeof (menuItem.action) != "function") menuItem.action = function () { };
	if (!menuItem.hideIf) menuItem.hideIf = function () { return false; };
	if (typeof (menuItem.expanded) != "function") menuItem.expanded = Xonomy.asFunction(menuItem.expanded, false);
};

Xonomy.nextID = function () {
	return `xonomy${++Xonomy.lastIDNum}`;
};
Xonomy.lastIDNum = 0;

Xonomy.docSpec = null;
Xonomy.refresh = function () {
	// Remove empty text nodes if the parent element is not allowed to have text
	document.querySelectorAll('.xonomy .textnode').forEach(function (el) {
		const parent = el.closest('.element');
		const parentName = parent ? parent.getAttribute('data-name') : null;
		const elSpec = parentName ? Xonomy.docSpec.elements[parentName] : null;
		if (elSpec && !elSpec.hasText(Xonomy.harvestElement(parent))) {
			if (el.getAttribute('data-value') === "") {
				el.remove();
			} else {
				const origText = el.getAttribute('data-value');
				const trimmedText = origText.trim();
				if (trimmedText !== origText) {
					const jsText = { type: "text", value: trimmedText };
					const html = Xonomy.renderText(jsText);
					el.outerHTML = html;
				}
			}
		}
	});
	// Determine whether each element does or doesn't have children
	document.querySelectorAll('.xonomy .children').forEach(function (el) {
		if (el.childNodes.length === 0 && !(el.parentNode.classList.contains('hasText'))) {
			el.parentNode.classList.add('noChildren');
		} else {
			el.parentNode.classList.remove('noChildren');
			Xonomy.updateCollapsoid(el.parentNode.id);
		}
	});
	// Ensure each child element of hasText element has empty text nodes on either side
	document.querySelectorAll('.xonomy .element.hasText > .children > .element').forEach(function (el) {
		const prev = el.previousElementSibling;
		if (!prev || !prev.classList.contains('textnode')) {
			el.insertAdjacentHTML('beforebegin', Xonomy.renderText({ type: "text", value: "" }));
		}
		const next = el.nextElementSibling;
		if (!next || !next.classList.contains('textnode')) {
			el.insertAdjacentHTML('afterend', Xonomy.renderText({ type: "text", value: "" }));
		}
	});
	// Merge adjacent text nodes
	let merged = false;
	while (!merged) {
		merged = true;
		const textnodes = Array.from(document.querySelectorAll('.xonomy .textnode'));
		for (let i = 0; i < textnodes.length; i++) {
			const thisNode = textnodes[i];
			const nextNode = thisNode.nextElementSibling;
			if (nextNode && nextNode.classList.contains('textnode')) {
				var js1 = Xonomy.harvestText(thisNode);
				var js2 = Xonomy.harvestText(nextNode);
				js1.value += js2.value;
				nextNode.remove();
				thisNode.outerHTML = Xonomy.renderText(js1);
				merged = false;
				break;
			}
		}
	}
	// Reorder attributes if necessary
	document.querySelectorAll('.xonomy .attribute').forEach(function (el) {
		const atName = el.getAttribute('data-name');
		const elName = el.parentNode.parentNode.parentNode.getAttribute('data-name');
		const elSpec = Xonomy.docSpec.elements[elName];
		const mustBeAfter = [];
		for (var sibName in elSpec.attributes) {
			if (sibName === atName) break; else mustBeAfter.push(sibName);
		}
		const mustBeBefore = [];
		let seen = false;
		for (var sibName in elSpec.attributes) {
			if (sibName === atName) seen = true; else if (seen) mustBeBefore.push(sibName);
		}
		if (mustBeBefore.length > 0) {
			var ok;
			do {
				ok = true;
				let prev = el.previousElementSibling;
				while (prev && mustBeBefore.includes(prev.getAttribute('data-name'))) {
					prev.parentNode.insertBefore(el, prev);
					ok = false;
					prev = el.previousElementSibling;
				}
			} while (!ok)
		}
		if (mustBeAfter.length > 0) {
			var ok;
			do {
				ok = true;
				let next = el.nextElementSibling;
				while (next && mustBeAfter.includes(next.getAttribute('data-name'))) {
					next.parentNode.insertBefore(next, el);
					ok = false;
					next = el.nextElementSibling;
				}
			} while (!ok)
		}
	});
	// Determine whether each attribute list has any shy attributes
	document.querySelectorAll('.xonomy .attributes').forEach(function (el) {
		if (el.querySelectorAll('.shy').length === 0) {
			var rollouter = el.parentNode.querySelector('.rollouter');
			if (rollouter) {
				rollouter.style.display = 'none';
				rollouter.classList.remove('rolledout');
			}
			el.classList.remove('rolledout');
			el.style.display = '';
		} else {
			var rollouter = el.parentNode.querySelector('.rollouter');
			if (rollouter) rollouter.style.display = '';
		}
	});
	// Refresh display names, display values and captions
	document.querySelectorAll('.xonomy .element').forEach(function (el) {
		const elSpec = Xonomy.docSpec.elements[el.getAttribute('data-name')];
		if (elSpec.displayName) el.querySelector('.tag .name').innerHTML = Xonomy.textByLang(elSpec.displayName(Xonomy.harvestElement(el)));
		if (elSpec.caption) {
			var jsEl = Xonomy.harvestElement(el);
			const inlinecaption = el.querySelector('.inlinecaption');
			if (inlinecaption) inlinecaption.innerHTML = Xonomy.textByLang(elSpec.caption(jsEl));
		}
		if (elSpec.displayValue) {
			var jsEl = Xonomy.harvestElement(el);
			if (!jsEl.hasElements()) {
				const children = el.querySelector('.children');
				if (children) children.innerHTML = Xonomy.textByLang(Xonomy.renderDisplayText(jsEl.getText(), elSpec.displayValue(jsEl)));
			}
		}
		el.querySelectorAll('.tag.opening > .attributes > .attribute').forEach(function (attrEl) {
			const atSpec = elSpec.attributes[attrEl.getAttribute('data-name')];
			if (atSpec.displayName) attrEl.querySelector('.name').innerHTML = Xonomy.textByLang(atSpec.displayName(Xonomy.harvestAttribute(attrEl)));
			if (atSpec.displayValue) attrEl.querySelector('.value').innerHTML = Xonomy.textByLang(atSpec.displayValue(Xonomy.harvestAttribute(attrEl)));
			if (atSpec.caption) attrEl.querySelector('.inlinecaption').innerHTML = "&nbsp;" + Xonomy.textByLang(atSpec.caption(Xonomy.harvestAttribute(attrEl))) + "&nbsp;";
		});
	});
};

Xonomy.harvestCache = {};
Xonomy.harvest = function () { //harvests the contents of an editor
	//Returns xml-as-string.
	const rootElement = document.querySelector('.xonomy .element');
	const js = Xonomy.harvestElement(rootElement);
	for (const key in Xonomy.namespaces) {
		if (!js.hasAttribute(key)) js.attributes.push({
			type: "attribute",
			name: key,
			value: Xonomy.namespaces[key],
			parent: js
		});
	}
	return Xonomy.js2xml(js);
}
Xonomy.harvestElement = function (htmlElement, jsParent) {
	const htmlID = htmlElement.id;
	if (!Xonomy.harvestCache[htmlID]) {
		let js = new Xonomy.surrogate(jsParent);
		js.type = "element";
		js.name = htmlElement.getAttribute("data-name");
		js.htmlID = htmlElement.id;
		js.attributes = [];
		const htmlAttributes = htmlElement.querySelector('.tag.opening > .attributes');
		if (htmlAttributes) {
			for (var i = 0; i < htmlAttributes.childNodes.length; i++) {
				const htmlAttribute = htmlAttributes.childNodes[i];
				if (htmlAttribute.nodeType === 1 && htmlAttribute.classList.contains("attribute")) js["attributes"].push(Xonomy.harvestAttribute(htmlAttribute, js));
			}
		}
		js.children = [];
		const htmlProminentChildren = Array.prototype.find.call(htmlElement.children, function (child) { return child.classList && child.classList.contains('prominentChildren'); });
		if (htmlProminentChildren) {
			for (var i = 0; i < htmlProminentChildren.childNodes.length; i++) {
				var htmlChild = htmlProminentChildren.childNodes[i];
				if (htmlChild.nodeType === 1) js["children"].push(Xonomy.harvestElement(htmlChild, js));
			}
		}
		const htmlChildren = Array.prototype.find.call(htmlElement.children, function (child) { return child.classList && child.classList.contains('children'); });
		if (htmlChildren) {
			for (var i = 0; i < htmlChildren.childNodes.length; i++) {
				var htmlChild = htmlChildren.childNodes[i];
				if (htmlChild.nodeType === 1 && htmlChild.classList.contains("element")) js["children"].push(Xonomy.harvestElement(htmlChild, js));
				else if (htmlChild.nodeType === 1 && htmlChild.classList.contains("textnode")) js["children"].push(Xonomy.harvestText(htmlChild, js));
			}
		}
		js = Xonomy.enrichElement(js);
		Xonomy.harvestCache[htmlID] = js;
	}
	return Xonomy.harvestCache[htmlID];
};
Xonomy.harvestAttribute = function (htmlAttribute, jsParent) {
	const htmlID = htmlAttribute.id;
	if (!Xonomy.harvestCache[htmlID]) {
		const js = new Xonomy.surrogate(jsParent);
		js.type = "attribute";
		js.name = htmlAttribute.getAttribute("data-name");
		js.htmlID = htmlAttribute.id;
		js.value = htmlAttribute.getAttribute("data-value");
		Xonomy.harvestCache[htmlID] = js;
	}
	return Xonomy.harvestCache[htmlID];
}

Xonomy.surrogate = function (jsParent) {
	this.internalParent = jsParent;
}
Xonomy.surrogate.prototype.parent = function () {
	if (!this.internalParent) {
		this.internalParent = Xonomy.harvestParentOf(this);
	}
	return this.internalParent;
}

Xonomy.harvestText = function (htmlText, jsParent) {
	const js = new Xonomy.surrogate(jsParent);
	js.type = "text";
	js.htmlID = htmlText.id;
	js.value = htmlText.getAttribute("data-value");
	return js;
}
Xonomy.harvestParentOf = function (js) {
	let jsParent = null;
	if (js.htmlID) {
		const elem = document.getElementById(js.htmlID);
		if (elem) {
			let parent = elem.parentElement;
			while (parent && (!parent.classList || !parent.classList.contains('element'))) {
				parent = parent.parentElement;
			}
			if (parent) {
				jsParent = Xonomy.harvestElement(parent);
				for (var i = 0; i < jsParent.attributes.length; i++) if (jsParent.attributes[i].htmlID == js.htmlID) jsParent.attributes[i] = js;
				for (var i = 0; i < jsParent.children.length; i++) if (jsParent.children[i].htmlID == js.htmlID) jsParent.children[i] = js;
			}
		}
	}
	return jsParent;
};

Xonomy.render = function (data, editor, docSpec) { //renders the contents of an editor
	//The data can be a Xonomy-compliant XML document, a Xonomy-compliant xml-as-string,
	//or a Xonomy-compliant JavaScript object.
	//The editor can be an HTML element, or the string ID of one.
	Xonomy.docSpec = docSpec;
	Xonomy.verifyDocSpec();

	//Clear namespace cache:
	Xonomy.namespaces = {};

	//Convert doc to a JavaScript object, if it isn't a JavaScript object already:
	if (typeof (data) == "string") {
		const parser = new window.DOMParser();
		data = parser.parseFromString(data, "application/xml");
	}
	if (data.documentElement) data = Xonomy.xml2js(data);

	//Make sure editor refers to an HTML element, if it doesn't already:
	if (typeof (editor) == "string") editor = document.getElementById(editor);
	//make sure it has class "xonomy"
	if (!editor.classList.contains("xonomy")) editor.classList.add("xonomy");

	if (!editor.classList.contains(Xonomy.mode)) editor.classList.add(Xonomy.mode);

	editor.style.display = "none";
	editor.innerHTML = Xonomy.renderElement(data, editor);
	editor.style.display = "";

	if (docSpec.allowLayby) {
		let laybyHtml = "<div class='layby closed empty' onclick='if(this.classList.contains(\"closed\")) Xonomy.openLayby()' ondragover='Xonomy.dragOver(event)' ondragleave='Xonomy.dragOut(event)' ondrop='Xonomy.drop(event)''>";
		laybyHtml += "<span class='button closer' onclick='Xonomy.closeLayby();'>&nbsp;</span>";
		laybyHtml += "<span class='button purger' onclick='Xonomy.emptyLayby()'>&nbsp;</span>";
		laybyHtml += "<div class='content'></div>";
		laybyHtml += "<div class='message'>" + Xonomy.textByLang(docSpec.laybyMessage) + "</div>";
		laybyHtml += "</div>";

		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = laybyHtml;
		while (tempDiv.firstChild) {
			editor.appendChild(tempDiv.firstChild);
		}
	}

	if (docSpec.allowModeSwitching) {
		const modeSwitcher = document.createElement('div');
		modeSwitcher.className = 'modeSwitcher';
		const nerdSpan = document.createElement('span');
		nerdSpan.className = 'nerd';
		const laicSpan = document.createElement('span');
		laicSpan.className = 'laic';
		modeSwitcher.appendChild(nerdSpan);
		modeSwitcher.appendChild(laicSpan);
		modeSwitcher.addEventListener('click', function (e) {
			if (Xonomy.mode == "nerd") { Xonomy.setMode("laic"); } else { Xonomy.setMode("nerd"); }
			if (docSpec.onModeSwitch) docSpec.onModeSwitch(Xonomy.mode);
		});
		editor.appendChild(modeSwitcher);
	}

	//Make sure the "click off" handler is attached:
	document.body.removeEventListener("click", Xonomy.clickoff);
	document.body.addEventListener("click", Xonomy.clickoff);

	//Make sure the "drag end" handler is attached:
	document.body.removeEventListener("dragend", Xonomy.dragend);
	document.body.addEventListener("dragend", Xonomy.dragend);

	Xonomy.refresh();
	Xonomy.validate();
};
Xonomy.renderElement = function (element) {
	const htmlID = Xonomy.nextID();
	Xonomy.verifyDocSpecElement(element.name);
	const spec = Xonomy.docSpec.elements[element.name];
	let classNames = "element";
	if (spec.canDropTo && spec.canDropTo.length > 0) classNames += " draggable";
	const hasText = spec.hasText(element);
	if (hasText) classNames += " hasText";
	if (spec.inlineMenu && spec.inlineMenu.length > 0) classNames += " hasInlineMenu";
	if (spec.oneliner(element)) classNames += " oneliner";
	if (!spec.collapsible(element)) {
		classNames += " uncollapsible";
	} else {
		if (spec.collapsed(element) && element.children.length > 0) classNames += " collapsed";
	}
	if (spec.isInvisible && spec.isInvisible(element)) { classNames += " invisible"; }
	if (spec.isReadOnly && spec.isReadOnly(element)) { readonly = true; classNames += " readonly"; }
	if (spec.menu.length > 0) classNames += " hasMenu"; //not always accurate: whether an element has a menu is actually determined at runtime
	let displayName = element.name;
	if (spec.displayName) displayName = Xonomy.textByLang(spec.displayName(element));
	let title = "";
	if (spec.title) title = Xonomy.textByLang(spec.title(element));
	let html = "";
	html += '<div data-name="' + element.name + '" id="' + htmlID + '" class="' + classNames + '">';
	html += '<span class="connector">';
	html += '<span class="plusminus" onclick="Xonomy.plusminus(\'' + htmlID + '\')"></span>';
	html += '<span class="draghandle" draggable="true" ondragstart="Xonomy.drag(event)"></span>';
	html += '</span>';
	html += '<span class="tag opening focusable" style="background-color: ' + spec.backgroundColour(element) + ';">';
	html += '<span class="punc">&lt;</span>';
	html += '<span class="warner"><span class="inside" onclick="Xonomy.click(\'' + htmlID + '\', \'warner\')"></span></span>';
	html += '<span class="name" title="' + title + '" onclick="Xonomy.click(\'' + htmlID + '\', \'openingTagName\')">' + displayName + '</span>';
	html += '<span class="attributes">';
	for (var i = 0; i < element.attributes.length; i++) {
		Xonomy.verifyDocSpecAttribute(element.name, element.attributes[i].name);
		html += Xonomy.renderAttribute(element.attributes[i], element.name);
	}
	html += '</span>';
	html += '<span class="rollouter focusable" onclick="Xonomy.click(\'' + htmlID + '\', \'rollouter\')"></span>';
	html += '<span class="punc slash">/</span>';
	html += '<span class="punc">&gt;</span>';
	html += '</span>';
	if (!spec.oneliner(element)) {
		html += "<span class='prominentChildren'>";
		for (let i = 0; i < element.children.length; i++) {
			const child = element.children[i];
			if (child.type == "element") { //element node
				if (spec.prominentChildren && spec.prominentChildren(element).indexOf(child.name) > -1) html += Xonomy.renderElement(child);
			}
		}
		html += "</span>";
	}
	if (spec.caption && !spec.oneliner(element)) html += `<span class='inlinecaption'>${Xonomy.textByLang(spec.caption(element))}</span>`;
	html += `<span class="childrenCollapsed focusable" onclick="Xonomy.plusminus('${htmlID}', true)">&middot;&middot;&middot;</span>`;
	html += '<div class="children">';
	if (spec.displayValue && !element.hasElements()) {
		html += Xonomy.renderDisplayText(element.getText(), spec.displayValue(element));
	} else {
		let prevChildType = "";
		if (hasText && (element.children.length == 0 || element.children[0].type == "element")) {
			html += Xonomy.renderText({ type: "text", value: "" }); //if inline layout, insert empty text node between two elements
		}
		for (let i = 0; i < element.children.length; i++) {
			const child = element.children[i];
			if (hasText && prevChildType == "element" && child.type == "element") {
				html += Xonomy.renderText({ type: "text", value: "" }); //if inline layout, insert empty text node between two elements
			}
			if (child.type == "text") html += Xonomy.renderText(child); //text node
			else if (child.type == "element") { //element node
				if (!spec.prominentChildren || spec.prominentChildren(element).indexOf(child.name) == -1) html += Xonomy.renderElement(child);
			}
			prevChildType = child.type;
		}
		if (hasText && element.children.length > 1 && element.children[element.children.length - 1].type == "element") {
			html += Xonomy.renderText({ type: "text", value: "" }); //if inline layout, insert empty text node between two elements
		}
	}
	html += '</div>';
	html += `<span class="tag closing focusable" style="background-color: ${spec.backgroundColour(element)};">`;
	html += '<span class="punc">&lt;</span>';
	html += '<span class="punc">/</span>';
	html += `<span class="name" onclick="Xonomy.click('${htmlID}', 'closingTagName')">${displayName}</span>`;
	html += '<span class="punc">&gt;</span>';
	html += '</span>';
	if (spec.oneliner(element)) {
		html += "<span class='prominentChildren'>";
		for (let i = 0; i < element.children.length; i++) {
			const child = element.children[i];
			if (child.type == "element") { //element node
				if (spec.prominentChildren && spec.prominentChildren(element).indexOf(child.name) > -1) html += Xonomy.renderElement(child);
			}
		}
		html += "</span>";
	}
	if (spec.caption && spec.oneliner(element)) html += `<span class='inlinecaption'>${Xonomy.textByLang(spec.caption(element))}</span>`;
	html += '</div>';
	element.htmlID = htmlID;
	return html;
};
Xonomy.renderAttribute = function (attribute, optionalParentName) {
	const htmlID = Xonomy.nextID();
	classNames = "attribute";
	let readonly = false;

	let displayName = attribute.name;
	let displayValue = Xonomy.xmlEscape(attribute.value);
	let caption = "";
	let title = "";
	if (optionalParentName) {
		const spec = Xonomy.docSpec.elements[optionalParentName].attributes[attribute.name];
		if (spec) {
			if (spec.displayName) displayName = Xonomy.textByLang(spec.displayName(attribute));
			if (spec.displayValue) displayValue = Xonomy.textByLang(spec.displayValue(attribute));
			if (spec.title) title = Xonomy.textByLang(spec.title(attribute));
			if (spec.caption) caption = Xonomy.textByLang(spec.caption(attribute));
			if (spec.isReadOnly && spec.isReadOnly(attribute)) { readonly = true; classNames += " readonly"; }
			if (spec.isInvisible && spec.isInvisible(attribute)) { classNames += " invisible"; }
			if (spec.shy && spec.shy(attribute)) { classNames += " shy"; }
		}
	}

	let html = "";
	html += `<span data-name="${attribute.name}" data-value="${Xonomy.xmlEscape(attribute.value)}" id="${htmlID}" class="${classNames}">`;
	html += '<span class="punc"> </span>';
	var onclick = readonly ? '' : ` onclick="Xonomy.click('${htmlID}', 'attributeName')"`;
	html += `<span class="warner"><span class="inside" onclick="Xonomy.click('${htmlID}', 'warner')"></span></span>`;
	html += `<span class="name attributeName focusable" title="${title}"${onclick}>${displayName}</span>`;
	html += '<span class="punc">=</span>';
	var onclick = readonly ? '' : ` onclick="Xonomy.click('${htmlID}', 'attributeValue')"`;
	html += `<span class="valueContainer attributeValue focusable"${onclick}>`;
	html += '<span class="punc">"</span>';
	html += `<span class="value">${displayValue}</span>`;
	html += '<span class="punc">"</span>';
	html += '</span>';
	if (caption) html += `<span class='inlinecaption'>${caption}</span>`;
	html += '</span>';
	attribute.htmlID = htmlID;
	return html;
};
Xonomy.renderText = function (text) {
	const htmlID = Xonomy.nextID();
	let classNames = "textnode focusable";
	if (String(text.value).trim() == "") classNames += " whitespace";
	if (text.value == "") classNames += " empty";
	let html = "";
	html += `<div id="${htmlID}" data-value="${Xonomy.xmlEscape(text.value)}" class="${classNames}">`;
	html += '<span class="connector"></span>';
	const txt = Xonomy.chewText(text.value);
	html += `<span class="value" onclick="Xonomy.click('${htmlID}', 'text')"><span class="insertionPoint"><span class="inside"></span></span><span class="dots"></span>${txt}</span>`;
	html += '</div>';
	text.htmlID = htmlID;
	return html;
}
Xonomy.renderDisplayText = function (text, displayText) {
	const htmlID = Xonomy.nextID();
	let classNames = "textnode";
	if (String(displayText).trim() == "") classNames += " whitespace";
	if (displayText == "") classNames += " empty";
	let html = "";
	html += `<div id="${htmlID}" data-value="${Xonomy.xmlEscape(text)}" class="${classNames}">`;
	html += '<span class="connector"></span>';
	html += `<span class="value" onclick="Xonomy.click('${htmlID}', 'text')"><span class="insertionPoint"><span class="inside"></span></span><span class="dots"></span>${Xonomy.textByLang(displayText)}</span>`;
	html += '</div>';
	text.htmlID = htmlID;
	return html;
}

Xonomy.chewText = function (txt) {
	let ret = "";
	ret += "<span class='word'>"; //start word
	for (let i = 0; i < txt.length; i++) {
		if (txt[i] == " ") ret += "</span>"; //end word
		var t = Xonomy.xmlEscape(txt[i])
		if (i == 0 && t == " ") t = "<span class='space'>&middot;</span>"; //leading space
		if (i == txt.length - 1 && t == " ") t = "<span class='space'>&middot;</span>"; //trailing space
		const id = Xonomy.nextID();
		ret += `<span id='${id}' class='char focusable' onclick='if((event.ctrlKey||event.metaKey) && this.closest(".element") && this.closest(".element").classList.contains("hasInlineMenu")) Xonomy.charClick(this)'>${t}<span class='selector'><span class='inside' onclick='Xonomy.charClick(this.parentNode.parentNode)'></span></span></span>`;
		if (txt[i] == " ") ret += "<span class='word'>"; //start word
	}
	ret += "</span>"; //end word
	return ret;
};
Xonomy.charClick = function (c) {
	Xonomy.clickoff();
	// Check if c or any ancestor has class 'readonly'
	let isReadOnly = false;
	let parent = c;
	while (parent) {
		if (parent.classList && parent.classList.contains('readonly')) {
			isReadOnly = true;
			break;
		}
		parent = parent.parentElement;
	}
	if (!isReadOnly) {
		Xonomy.notclick = true;
		const charsOn = document.querySelectorAll('.xonomy .char.on');
		if (
			charsOn.length == 1 &&
			charsOn[0].closest('.element') === c.closest('.element')
		) {
			const element = charsOn[0].closest('.element');
			const chars = Array.prototype.slice.call(element.querySelectorAll('.char'));
			let iFrom = chars.indexOf(charsOn[0]);
			let iTill = chars.indexOf(c);
			if (iFrom > iTill) { var temp = iFrom; iFrom = iTill; iTill = temp; }
			for (let i = 0; i < chars.length; i++) {
				if (i >= iFrom && i <= iTill) chars[i].classList.add('on');
			}
			// Save for later the info Xonomy needs to know what to wrap:
			const textFrom = chars[iFrom].closest('.textnode');
			const textTill = chars[iTill].closest('.textnode');
			Xonomy.textFromID = textFrom ? textFrom.id : null;
			Xonomy.textTillID = textTill ? textTill.id : null;
			const charsFromText = textFrom ? Array.prototype.slice.call(textFrom.querySelectorAll('.char')) : [];
			const charsTillText = textTill ? Array.prototype.slice.call(textTill.querySelectorAll('.char')) : [];
			Xonomy.textFromIndex = charsFromText.indexOf(chars[iFrom]);
			Xonomy.textTillIndex = charsTillText.indexOf(chars[iTill]);
			// Show inline menu etc:
			const htmlID = element.id;
			const content = Xonomy.inlineMenu(htmlID);
			if (content != "" && content != "<div class='menu'></div>") {
				document.body.appendChild(Xonomy.makeBubble(content));
				const charsOnList = element.querySelectorAll('.char.on');
				if (charsOnList.length > 0) Xonomy.showBubble(charsOnList[charsOnList.length - 1]);
			}
			Xonomy.clearChars = true;
		} else {
			// Remove all .on from .char
			Array.prototype.forEach.call(document.querySelectorAll('.xonomy .char.on'), function (el) { el.classList.remove('on'); });
			c.classList.add('on');
			Xonomy.setFocus(c.id, "char");
		}
	}
};
Xonomy.wrap = function (htmlID, param) {
	Xonomy.clickoff();
	Xonomy.destroyBubble();
	let xml = param.template;
	const ph = param.placeholder;
	const jsElement = Xonomy.harvestElement(document.getElementById(htmlID));
	if (Xonomy.textFromID == Xonomy.textTillID) { //abc --> a<XYZ>b</XYZ>c
		const jsOld = Xonomy.harvestText(document.getElementById(Xonomy.textFromID));
		var txtOpen = jsOld.value.substring(0, Xonomy.textFromIndex);
		const txtMiddle = jsOld.value.substring(Xonomy.textFromIndex, Xonomy.textTillIndex + 1);
		var txtClose = jsOld.value.substring(Xonomy.textTillIndex + 1);
		xml = xml.replace(ph, Xonomy.xmlEscape(txtMiddle));
		var html = "";
		html += Xonomy.renderText({ type: "text", value: txtOpen });
		var js = Xonomy.xml2js(xml, jsElement); html += Xonomy.renderElement(js); var newID = js.htmlID;
		html += Xonomy.renderText({ type: "text", value: txtClose });
		var textFromElem = document.getElementById(Xonomy.textFromID);
		if (textFromElem) {
			var tempDiv = document.createElement('div');
			tempDiv.innerHTML = html;
			textFromElem.replaceWith(...tempDiv.childNodes);
		}
		window.setTimeout(function () { Xonomy.setFocus(newID, "openingTagName"); }, 100);
	} else { //ab<...>cd --> a<XYZ>b<...>c</XYZ>d
		const jsOldOpen = Xonomy.harvestText(document.getElementById(Xonomy.textFromID));
		const jsOldClose = Xonomy.harvestText(document.getElementById(Xonomy.textTillID));
		var txtOpen = jsOldOpen.value.substring(0, Xonomy.textFromIndex);
		const txtMiddleOpen = jsOldOpen.value.substring(Xonomy.textFromIndex);
		const txtMiddleClose = jsOldClose.value.substring(0, Xonomy.textTillIndex + 1);
		var txtClose = jsOldClose.value.substring(Xonomy.textTillIndex + 1);
		xml = xml.replace(ph, Xonomy.xmlEscape(txtMiddleOpen) + ph);
		// Vanilla JS nextUntil implementation
		const startElem = document.getElementById(Xonomy.textFromID);
		const endElem = document.getElementById(Xonomy.textTillID);
		let current = startElem.nextElementSibling;
		const nodesToRemove = [];
		while (current && current !== endElem) {
			if (current.classList.contains("element")) {
				xml = xml.replace(ph, Xonomy.js2xml(Xonomy.harvestElement(current)) + ph);
			} else if (current.classList.contains("textnode")) {
				xml = xml.replace(ph, Xonomy.js2xml(Xonomy.harvestText(current)) + ph);
			}
			nodesToRemove.push(current);
			current = current.nextElementSibling;
		}
		xml = xml.replace(ph, Xonomy.xmlEscape(txtMiddleClose));
		// Remove nodes between start and end
		nodesToRemove.forEach(function (node) { node.parentNode.removeChild(node); });
		// Remove end node
		if (endElem) endElem.parentNode.removeChild(endElem);
		var html = "";
		html += Xonomy.renderText({ type: "text", value: txtOpen });
		var js = Xonomy.xml2js(xml, jsElement); html += Xonomy.renderElement(js); var newID = js.htmlID;
		html += Xonomy.renderText({ type: "text", value: txtClose });
		var textFromElem = document.getElementById(Xonomy.textFromID);
		if (textFromElem) {
			var tempDiv = document.createElement('div');
			tempDiv.innerHTML = html;
			textFromElem.replaceWith(...tempDiv.childNodes);
		}
		window.setTimeout(function () { Xonomy.setFocus(newID, "openingTagName"); }, 100);
	}
	Xonomy.changed();
};
Xonomy.unwrap = function (htmlID, param) {
	const elem = document.getElementById(htmlID);
	const parentID = elem.parentNode.parentNode.id;
	Xonomy.clickoff();
	const children = elem.querySelectorAll(':scope > .children > *');
	const fragment = document.createDocumentFragment();
	children.forEach(function (child) {
		fragment.appendChild(child);
	});
	elem.replaceWith(fragment);
	Xonomy.changed();
	window.setTimeout(function () { Xonomy.setFocus(parentID, "openingTagName"); }, 100);
};

Xonomy.plusminus = function (htmlID, forceExpand) {
	const element = document.getElementById(htmlID);
	const children = element.querySelector('.children');
	// Helper functions for animation
	function fadeIn(el, duration = 200, display = '') {
		el.style.opacity = 0;
		el.style.display = display;
		let last = +new Date();
		const tick = function () {
			el.style.opacity = +el.style.opacity + (new Date() - last) / duration;
			last = +new Date();
			if (+el.style.opacity < 1) {
				(window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
			} else {
				el.style.opacity = 1;
			}
		};
		tick();
	}
	function fadeOut(el, duration = 200, callback) {
		el.style.opacity = 1;
		let last = +new Date();
		const tick = function () {
			el.style.opacity = +el.style.opacity - (new Date() - last) / duration;
			last = +new Date();
			if (+el.style.opacity > 0) {
				(window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
			} else {
				el.style.opacity = 0;
				el.style.display = 'none';
				if (typeof callback === 'function') callback();
			}
		};
		tick();
	}
	function slideDown(el, duration = 200, display = '') {
		el.style.removeProperty('display');
		let computedDisplay = window.getComputedStyle(el).display;
		if (computedDisplay === 'none') computedDisplay = display || 'block';
		el.style.display = computedDisplay;
		const height = el.offsetHeight;
		el.style.overflow = 'hidden';
		el.style.height = '0px';
		el.offsetHeight; // force repaint
		el.style.transition = `height ${duration}ms`;
		el.style.height = height + 'px';
		setTimeout(function () {
			el.style.removeProperty('height');
			el.style.removeProperty('overflow');
			el.style.removeProperty('transition');
		}, duration);
	}
	function slideUp(el, duration = 200, callback) {
		el.style.height = el.offsetHeight + 'px';
		el.style.overflow = 'hidden';
		el.offsetHeight; // force repaint
		el.style.transition = `height ${duration}ms`;
		el.style.height = '0px';
		setTimeout(function () {
			el.style.display = 'none';
			el.style.removeProperty('height');
			el.style.removeProperty('overflow');
			el.style.removeProperty('transition');
			if (typeof callback === 'function') callback();
		}, duration);
	}
	// Expand
	if (element.classList.contains('collapsed')) {
		if (children) {
			children.style.display = 'none';
		}
		element.classList.remove('collapsed');
		if (children) {
			if (element.classList.contains('oneliner')) {
				fadeIn(children, 200, '');
			} else {
				slideDown(children, 200, '');
			}
		}
	} else if (!forceExpand) {
		Xonomy.updateCollapsoid(htmlID);
		if (children) {
			if (element.classList.contains('oneliner')) {
				fadeOut(children, 200, function () {
					element.classList.add('collapsed');
				});
			} else {
				slideUp(children, 200, function () {
					element.classList.add('collapsed');
				});
			}
		}
	}
	// Focus logic: check for visible .opening
	setTimeout(function () {
		const currentElem = document.getElementById(Xonomy.currentHtmlId);
		let openingVisible = false;
		if (currentElem) {
			const opening = currentElem.querySelector('.opening');
			if (opening) {
				const style = window.getComputedStyle(opening);
				openingVisible = style.display !== 'none' && style.visibility !== 'hidden' && opening.offsetParent !== null;
			}
		}
		if (openingVisible) {
			Xonomy.setFocus(Xonomy.currentHtmlId, 'openingTagName');
		} else {
			Xonomy.setFocus(Xonomy.currentHtmlId, 'childrenCollapsed');
		}
	}, 300);
};
Xonomy.updateCollapsoid = function (htmlID) {
	const element = document.getElementById(htmlID);
	let whisper = "";
	const elementName = element.getAttribute("data-name");
	const spec = Xonomy.docSpec.elements[elementName];
	if (spec.collapsoid) {
		whisper = spec.collapsoid(Xonomy.harvestElement(element));
	} else {
		let abbreviated = false;
		// Find all .textnode descendants of element, excluding those inside any direct child .prominentChildren
		const textnodes = Array.from(element.querySelectorAll('.textnode'));
		// Get all direct children .prominentChildren of element
		const directProminentChildren = Array.from(element.children).filter(function (child) {
			return child.classList && child.classList.contains('prominentChildren');
		});
		// For each textnode, check if it is NOT a descendant of any directProminentChildren
		textnodes.forEach(function (textnode) {
			const insideProminent = directProminentChildren.some(function (promChild) {
				return promChild.contains(textnode);
			});
			if (!insideProminent) {
				const txt = Xonomy.harvestText(textnode).value;
				for (const el2 of txt) {
					if (whisper.length < 35) whisper += el2; else abbreviated = true;
				}
				whisper += " ";
			}
		});
		whisper = whisper.replace(/  +/g, " ").replace(/ +$/g, "").replace(/^ +/g, "");
		if (abbreviated && !element.classList.contains("oneliner") && whisper != "...") whisper += "...";
	}
	if (whisper == "" || !whisper) whisper = "...";
	const childrenCollapsed = element.querySelector(':scope > .childrenCollapsed');
	if (childrenCollapsed) {
		childrenCollapsed.innerHTML = whisper;
	}
};

Xonomy.lastClickWhat = "";
Xonomy.click = function (htmlID, what) {
	if (!Xonomy.notclick) {
		Xonomy.clickoff();
		Xonomy.lastClickWhat = what;
		Xonomy.currentHtmlId = htmlID;
		Xonomy.currentFocus = what;

		const charOn = document.querySelectorAll('.xonomy .char.on');
		charOn.forEach(function (el) { el.classList.remove('on'); });
		const elem = document.getElementById(htmlID);
		const isReadOnly = elem.classList.contains("readonly") || elem.closest('.readonly') !== null;
		if (!isReadOnly && (what == "openingTagName" || what == "closingTagName")) {
			Xonomy.handleElementClick(htmlID, what);
		}
		if (!isReadOnly && what == "attributeName") {
			elem.classList.add("current"); //make the attribute current
			var content = Xonomy.attributeMenu(htmlID); //compose bubble content
			if (content != "" && content != "<div class='menu'></div>") {
				document.body.appendChild(Xonomy.makeBubble(content)); //create bubble
				Xonomy.showBubble(elem.querySelector('> .name'));
			}
			const surrogateAttr = Xonomy.harvestAttribute(elem);
			var event = new CustomEvent('xonomy-click-attribute', { detail: surrogateAttr });
			elem.dispatchEvent(event);
		}
		if (!isReadOnly && what == "attributeValue") {
			const valueContainer = elem.querySelector('> .valueContainer');
			if (valueContainer) valueContainer.classList.add("current"); //make attribute value current
			const name = elem.getAttribute("data-name"); //obtain attribute's name
			var value = elem.getAttribute("data-value"); //obtain current value
			var elName = elem.closest('.element').getAttribute('data-name');
			Xonomy.verifyDocSpecAttribute(elName, name);
			var spec = Xonomy.docSpec.elements[elName].attributes[name];
			var jsMe = Xonomy.harvestAttribute(elem);
			var content = spec.asker(value, spec.askerParameter(jsMe), jsMe); //compose bubble content
			if (content != "" && content != "<div class='menu'></div>") {
				document.body.appendChild(Xonomy.makeBubble(content)); //create bubble
				Xonomy.showBubble(elem.querySelector('> .valueContainer > .value'));
				Xonomy.answer = function (val) {
					const html = Xonomy.renderAttribute({ type: "attribute", name: name, value: val }, elName);
					elem.outerHTML = html;
					Xonomy.changed();
					window.setTimeout(function () { Xonomy.clickoff(); Xonomy.setFocus(document.getElementById(htmlID).id, what) }, 100);
				};
			}
		}
		if (!isReadOnly && what == "text") {
			elem.classList.add("current");
			var value = elem.getAttribute("data-value"); //obtain current value
			var elName = elem.closest('.element').getAttribute('data-name');
			var spec = Xonomy.docSpec.elements[elName];
			var content;
			if (typeof (spec.asker) != "function") {
				content = Xonomy.askLongString(value, null, Xonomy.harvestElement(elem.closest('.element'))); //compose bubble content
			} else {
				var jsMe = Xonomy.harvestElement(elem.closest('.element'));
				content = spec.asker(value, spec.askerParameter(jsMe), jsMe); //use specified asker
			}
			if (content != "" && content != "<div class='menu'></div>") {
				document.body.appendChild(Xonomy.makeBubble(content)); //create bubble
				Xonomy.showBubble(elem.querySelector('> .value'));
				Xonomy.answer = function (val) {
					const jsText = { type: "text", value: val };
					const html = Xonomy.renderText(jsText);
					let prevHtmlId, prevWhat;
					const prevElem = elem.previousElementSibling;
					if (prevElem && prevElem.classList.contains('element')) {
						prevHtmlId = prevElem.id;
						prevWhat = "closingTagName";
					} else {
						const closestElem = elem.closest('.element');
						prevHtmlId = closestElem ? closestElem.id : null;
						prevWhat = "openingTagName";
					}
					elem.outerHTML = html;
					Xonomy.changed(Xonomy.harvestText(document.getElementById(jsText.htmlID)));
					window.setTimeout(function () {
						var newElem = document.getElementById(jsText.htmlID);
						Xonomy.clickoff();
						if (newElem) {
							Xonomy.setFocus(newElem.id, what);
						} else if (prevHtmlId) {
							Xonomy.setFocus(prevHtmlId, prevWhat);
						}
					}, 100);
				};
			}
		}
		if (what == "warner") {
			var content = ""; //compose bubble content
			for (const warningElement of Xonomy.warnings) {
				const warning = warningElement;
				if (warning.htmlID == htmlID) {
					content += "<div class='warning'>" + Xonomy.formatCaption(Xonomy.textByLang(warning.text)) + "</div>";
				}
			}
			document.body.appendChild(Xonomy.makeBubble(content)); //create bubble
			const warnerInside = elem.querySelector('.warner .inside');
			if (warnerInside) Xonomy.showBubble(warnerInside); //anchor bubble to warner
		}
		if (what == "rollouter") {
			const tagOpening = elem.querySelector('.tag.opening');
			const attributes = tagOpening ? tagOpening.querySelector('.attributes') : null;
			const rollouter = tagOpening ? tagOpening.querySelector('.rollouter') : null;
			if (attributes && attributes.querySelector('.shy')) {
				if (rollouter && rollouter.classList.contains('rolledout')) {
					rollouter.classList.remove('rolledout');
					attributes.classList.remove('rolledout');
					attributes.style.display = '';
				} else if (rollouter) {
					rollouter.classList.add('rolledout');
					attributes.classList.add('rolledout');
					attributes.style.display = 'none';
					// Simulate slideDown
					setTimeout(function () { attributes.style.display = ''; }, 0);
				}
				window.setTimeout(function () { Xonomy.setFocus(htmlID, "rollouter") }, 100);
			}
		}
		Xonomy.notclick = true;
	}
};
Xonomy.notclick = false; //should the latest click-off event be ignored?
Xonomy.clearChars = false; //if true, un-highlight any highlighted characters at the next click-off event
Xonomy.clickoff = function () { //event handler for the document-wide click-off event.
	if (!Xonomy.notclick) {
		Xonomy.currentHtmlId = null;
		Xonomy.currentFocus = null;
		Xonomy.destroyBubble();
		document.querySelectorAll('.xonomy .current').forEach(function (el) {
			el.classList.remove('current');
		});
		document.querySelectorAll('.xonomy .focused').forEach(function (el) {
			el.classList.remove('focused');
		});
		if (Xonomy.clearChars) {
			document.querySelectorAll('.xonomy .char.on').forEach(function (el) {
				el.classList.remove('on');
			});
			Xonomy.clearChars = false;
		}
	}
	Xonomy.notclick = false;
};

Xonomy.destroyBubble = function () {
	if (document.getElementById("xonomyBubble")) {
		const bubble = document.getElementById("xonomyBubble");
		// Find any focused element inside the bubble and blur it
		const focused = bubble.querySelector(":focus");
		if (focused) focused.blur();
		bubble.parentNode.removeChild(bubble);
		if (Xonomy.keyboardEventCatcher) Xonomy.keyboardEventCatcher.focus();
	}
};
Xonomy.makeBubble = function (content) {
	Xonomy.destroyBubble();
	const bubble = document.createElement("div");
	bubble.id = "xonomyBubble";
	bubble.className = Xonomy.mode;
	bubble.innerHTML = "<div class='inside' onclick='Xonomy.notclick=true;'>"
		+ "<div id='xonomyBubbleContent'>" + content + "</div>"
		+ "</div>";
	return bubble;
};
Xonomy.showBubble = function (anchor) {
	const bubble = document.getElementById("xonomyBubble");

	// Get anchor position relative to document
	const anchorRect = anchor.getBoundingClientRect();
	const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
	const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
	const offset = {
		top: anchorRect.top + scrollTop,
		left: anchorRect.left + scrollLeft
	};

	// Get screen and bubble dimensions
	const screenWidth = document.body.clientWidth;
	const screenHeight = document.documentElement.scrollHeight;
	const bubbleHeight = bubble.offsetHeight;
	let width = anchor.offsetWidth; if (width > 40) width = 40;
	let height = anchor.offsetHeight; if (height > 25) height = 25;
	if (Xonomy.mode == "laic") { width = width - 25; height = height + 10; }

	function verticalPlacement() {
		let top = "";
		let bottom = "";
		if (offset.top + height + bubbleHeight <= screenHeight) {
			// enough space - open down
			top = (offset.top + height) + "px";
		} else if (screenHeight - offset.top + 5 + bubbleHeight > 0) {
			// 5px above for some padding. Anchor using bottom so animation opens upwards.
			bottom = (screenHeight - offset.top + 5) + "px";
		} else {
			// neither downwards nor upwards is enough space => center the bubble
			top = (screenHeight - bubbleHeight) / 2 + "px";
		}
		return { top: top, bottom: bottom };
	}

	const placement = verticalPlacement();
	if (offset.left < screenWidth / 2) {
		placement.left = (offset.left + width - 15) + "px";
	} else {
		bubble.classList.add("rightAnchored");
		placement.right = (screenWidth - offset.left) + "px";
	}

	bubble.style.top = placement.top || "";
	bubble.style.bottom = placement.bottom || "";
	bubble.style.left = placement.left || "";
	bubble.style.right = placement.right || "";

	// Show the bubble with a simple fade-in effect (optional)
	bubble.style.display = "block";
	bubble.style.opacity = 0;
	bubble.style.transition = "opacity 0.2s";
	requestAnimationFrame(function () {
		bubble.style.opacity = 1;
	});

	// Focus logic
	let focusElem = null;
	if (Xonomy.keyNav) {
		focusElem = bubble.querySelector(".focusme");
	} else {
		focusElem = bubble.querySelector("input.focusme, select.focusme, textarea.focusme");
	}
	if (focusElem) focusElem.focus();

	// Remove any previous keyup event listeners to avoid duplicates
	bubble.onkeyup = null;
	// Keyup event for ESC
	bubble.addEventListener("keyup", function (event) {
		if (event.key === "Escape" || event.keyCode === 27) Xonomy.destroyBubble();
	});

	// Key navigation for menu items if keyNav is enabled
	if (Xonomy.keyNav) {
		const focusDivs = bubble.querySelectorAll("div.focusme");
		focusDivs.forEach(function (div) {
			div.onkeyup = null;
			div.addEventListener("keyup", function (event) {
				if (event.which == 40) { //down key
					var items = Array.from(bubble.querySelectorAll(".focusme"));
					var idx = items.indexOf(div);
					const next = items[idx + 1];
					if (next) next.focus();
				}
				if (event.which == 38) { //up key
					var items = Array.from(bubble.querySelectorAll("div.focusme"));
					var idx = items.indexOf(div);
					const prev = items[idx - 1];
					if (prev) prev.focus();
				}
				if (event.which == 13) { //enter key
					div.click();
					Xonomy.notclick = false;
				}
			});
		});
	}
};

Xonomy.askString = function (defaultString, askerParameter, jsMe) {
	const width = (document.body.clientWidth * 0.5) - 75;
	let html = "";
	html += "<form onsubmit='Xonomy.answer(this.val.value); return false'>";
	html += `<input name='val' class='textbox focusme' style='width: ${width}px;' value='${Xonomy.xmlEscape(defaultString)}' onkeyup='Xonomy.notKeyUp=true'/>`;
	html += " <input type='submit' value='OK'>";
	html += "</form>";
	return html;
};
Xonomy.askLongString = function (defaultString, askerParameter, jsMe) {
	const width = (document.body.clientWidth * 0.5) - 75;
	let html = "";
	html += "<form onsubmit='Xonomy.answer(this.val.value); return false'>";
	html += `<textarea name='val' class='textbox focusme' spellcheck='false' style='width: ${width}px; height: 150px;'>${Xonomy.xmlEscape(defaultString)}</textarea>`;
	html += "<div class='submitline'><input type='submit' value='OK'></div>";
	html += "</form>";
	return html;
};
Xonomy.askPicklist = function (defaultString, picklist, jsMe) {
	let html = "";
	html += Xonomy.pickerMenu(picklist, defaultString);
	return html;
};
Xonomy.askOpenPicklist = function (defaultString, picklist) {
	const isInPicklist = false;
	let html = "";
	html += Xonomy.pickerMenu(picklist, defaultString);
	html += "<form class='undermenu' onsubmit='Xonomy.answer(this.val.value); return false'>";
	html += `<input name='val' class='textbox focusme' value='${isInPicklist ? "" : Xonomy.xmlEscape(defaultString)}' onkeyup='Xonomy.notKeyUp=true'/>`;
	html += " <input type='submit' value='OK'>";
	html += "</form>";
	return html;
};
Xonomy.askRemote = function (defaultString, param, jsMe) {
	let html = "";
	if (param.searchUrl || param.createUrl) {
		html += `<form class='overmenu' onsubmit='return Xonomy.remoteSearch("${Xonomy.xmlEscape(param.searchUrl, true)}", "${Xonomy.xmlEscape(param.urlPlaceholder, true)}", "${Xonomy.xmlEscape(Xonomy.jsEscape(defaultString))}")'>`;
		html += "<input name='val' class='textbox focusme' value=''/>";
		if (param.searchUrl) html += ` <button class='buttonSearch' onclick='return Xonomy.remoteSearch("${Xonomy.xmlEscape(param.searchUrl, true)}", "${Xonomy.xmlEscape(param.urlPlaceholder, true)}", "${Xonomy.xmlEscape(Xonomy.jsEscape(defaultString))}")'>&nbsp;</button>`;
		if (param.createUrl) html += ` <button class='buttonCreate' onclick='return Xonomy.remoteCreate("${Xonomy.xmlEscape(param.createUrl, true)}", "${Xonomy.xmlEscape((param.searchUrl ? param.searchUrl : param.url), true)}", "${Xonomy.xmlEscape(param.urlPlaceholder, true)}", "${Xonomy.xmlEscape(Xonomy.jsEscape(defaultString))}")'>&nbsp;</button>`;
		html += "</form>";
	}
	html += Xonomy.wyc(param.url, function (picklist) {
		const items = [];
		if (param.add) for (var i = 0; i < param.add.length; i++) items.push(param.add[i]);
		for (var i = 0; i < picklist.length; i++) items.push(picklist[i]);
		return Xonomy.pickerMenu(items, defaultString);
	});
	Xonomy.lastAskerParam = param;
	return html;
};
Xonomy.lastAskerParam = null;
Xonomy.remoteSearch = function (searchUrl, urlPlaceholder, defaultString) {
	// Use vanilla JS to get the value of the input
	const bubble = document.getElementById("xonomyBubble");
	const inputElem = bubble ? bubble.querySelector("input.textbox") : null;
	const text = inputElem ? inputElem.value : "";
	searchUrl = searchUrl.replace(urlPlaceholder, encodeURIComponent(text));
	// Use vanilla JS to find and replace the .menu element
	const menuElem = bubble ? bubble.querySelector(".menu") : null;
	if (menuElem) {
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = Xonomy.wyc(searchUrl, function (picklist) {
			const items = [];
			if (text == "" && Xonomy.lastAskerParam.add) {
				for (var i = 0; i < Xonomy.lastAskerParam.add.length; i++) items.push(Xonomy.lastAskerParam.add[i]);
			}
			for (var i = 0; i < picklist.length; i++) items.push(picklist[i]);
			return Xonomy.pickerMenu(items, defaultString);
		});
		menuElem.replaceWith(tempDiv.firstChild);
	}
	return false;
};
Xonomy.remoteCreate = function (createUrl, searchUrl, urlPlaceholder, defaultString) {
	const inputElem = document.querySelector("#xonomyBubble input.textbox");
	const text = inputElem ? inputElem.value.trim() : "";
	if (text != "") {
		createUrl = createUrl.replace(urlPlaceholder, encodeURIComponent(text));
		searchUrl = searchUrl.replace(urlPlaceholder, encodeURIComponent(text));
		fetch(createUrl, { method: "POST" })
			.then(function (response) { return response.text(); })
			.then(function (data) {
				if (Xonomy.wycCache[searchUrl]) delete Xonomy.wycCache[searchUrl];
				const bubble = document.getElementById("xonomyBubble");
				if (bubble) {
					const menuElem = bubble.querySelector(".menu");
					if (menuElem) {
						// Create a temporary container for the new HTML
						const tempDiv = document.createElement("div");
						tempDiv.innerHTML = Xonomy.wyc(searchUrl, function (picklist) { return Xonomy.pickerMenu(picklist, defaultString); });
						// Replace the menu element
						menuElem.replaceWith(tempDiv.firstChild);
					}
				}
			});
	}
	return false;
};
Xonomy.pickerMenu = function (picklist, defaultString) {
	let html = "";
	html += "<div class='menu'>";
	for (const element of picklist) {
		let item = element;
		if (typeof (item) == "string") item = { value: item, caption: "" };
		html += `<div class='menuItem focusme techno${item.value == defaultString ? " current" : ""}' tabindex='1' onclick='Xonomy.answer("${Xonomy.xmlEscape(item.value)}")'>`;
		let alone = true;
		html += "<span class='punc'>\"</span>";
		if (item.displayValue) {
			html += Xonomy.textByLang(item.displayValue);
			alone = false;
		} else {
			html += Xonomy.xmlEscape(item.value);
			if (item.value) alone = false;
		}
		html += "<span class='punc'>\"</span>";
		if (item.caption != "") html += " <span class='explainer " + (alone ? "alone" : "") + "'>" + Xonomy.xmlEscape(Xonomy.textByLang(item.caption)) + "</span>";
		html += "</div>";
	}
	html += "</div>";
	return html;
};

Xonomy.wycLastID = 0;
Xonomy.wycCache = {};
Xonomy.wycQueue = [];
Xonomy.wycIsRunning = false;
Xonomy.wyc = function (url, callback) { //a "when-you-can" function for delayed rendering: gets json from url, passes it to callback, and delayed-returns html-as-string from callback
	Xonomy.wycLastID++;
	const wycID = "xonomy_wyc_" + Xonomy.wycLastID;
	if (Xonomy.wycCache[url]) return callback(Xonomy.wycCache[url]);
	Xonomy.wycQueue.push(function () { //push job to WYC queue
		Xonomy.wycIsRunning = true;
		Xonomy.wycQueue.shift(); //remove myself from the WYC queue
		if (Xonomy.wycCache[url]) {
			const wycElem = document.getElementById(wycID);
			if (wycElem) {
				const tempDiv = document.createElement("div");
				tempDiv.innerHTML = callback(Xonomy.wycCache[url]);
				wycElem.replaceWith(tempDiv.firstChild);
			}
			if (Xonomy.wycQueue.length > 0) Xonomy.wycQueue[0](); else Xonomy.wycIsRunning = false; //run the next WYC job, or say that WYC has finished running
		} else {
			fetch(url, { method: "POST", headers: { 'Accept': 'application/json' } })
				.then(function (response) { return response.json(); })
				.then(function (data) {
					const wycElem = document.getElementById(wycID);
					if (wycElem) {
						const tempDiv = document.createElement("div");
						tempDiv.innerHTML = callback(data);
						wycElem.replaceWith(tempDiv.firstChild);
					}
					if (Xonomy.wycCache.length > 1000) Xonomy.wycCache.length = [];
					Xonomy.wycCache[url] = data;
					if (Xonomy.wycQueue.length > 0) Xonomy.wycQueue[0](); else Xonomy.wycIsRunning = false; //run the next WYC job, or say that WYC has finished running
				});
		}
	});
	if (!Xonomy.wycIsRunning && Xonomy.wycQueue.length > 0) Xonomy.wycQueue[0]();
	return `<span class='wyc' id='${wycID}'></span>`;
};

Xonomy.toggleSubmenu = function (menuItem) {
	// Helper to slide up (collapse)
	function slideUp(element, duration, callback) {
		element.style.height = `${element.offsetHeight}px`;
		element.style.transitionProperty = 'height, margin, padding';
		element.style.transitionDuration = `${duration}ms`;
		element.offsetHeight; // force repaint
		element.style.overflow = 'hidden';
		element.style.height = 0;
		element.style.paddingTop = 0;
		element.style.paddingBottom = 0;
		element.style.marginTop = 0;
		element.style.marginBottom = 0;
		window.setTimeout(function () {
			element.style.display = 'none';
			element.style.removeProperty('height');
			element.style.removeProperty('padding-top');
			element.style.removeProperty('padding-bottom');
			element.style.removeProperty('margin-top');
			element.style.removeProperty('margin-bottom');
			element.style.removeProperty('overflow');
			element.style.removeProperty('transition-property');
			element.style.removeProperty('transition-duration');
			if (typeof callback === 'function') callback();
		}, duration);
	}
	// Helper to slide down (expand)
	function slideDown(element, duration, callback) {
		element.style.removeProperty('display');
		let display = window.getComputedStyle(element).display;
		if (display === 'none') display = 'block';
		element.style.display = display;
		const height = element.offsetHeight;
		element.style.height = 0;
		element.style.paddingTop = 0;
		element.style.paddingBottom = 0;
		element.style.marginTop = 0;
		element.style.marginBottom = 0;
		element.offsetHeight; // force repaint
		element.style.transitionProperty = 'height, margin, padding';
		element.style.transitionDuration = `${duration}ms`;
		element.style.overflow = 'hidden';
		element.style.height = `${height}px`;
		element.style.removeProperty('padding-top');
		element.style.removeProperty('padding-bottom');
		element.style.removeProperty('margin-top');
		element.style.removeProperty('margin-bottom');
		window.setTimeout(function () {
			element.style.removeProperty('height');
			element.style.removeProperty('overflow');
			element.style.removeProperty('transition-property');
			element.style.removeProperty('transition-duration');
			if (typeof callback === 'function') callback();
		}, duration);
	}
	const menuItemEl = menuItem;
	if (menuItemEl.classList.contains('expanded')) {
		var submenu = menuItemEl.querySelector('.submenu');
		if (submenu) {
			slideUp(submenu, 200, function () {
				menuItemEl.classList.remove('expanded');
			});
		} else {
			menuItemEl.classList.remove('expanded');
		}
	} else {
		var submenu = menuItemEl.querySelector('.submenu');
		if (submenu) {
			slideDown(submenu, 200, function () {
				menuItemEl.classList.add('expanded');
			});
		} else {
			menuItemEl.classList.add('expanded');
		}
	}
}
Xonomy.internalMenu = function (htmlID, items, harvest, getter, indices) {
	Xonomy.harvestCache = {};
	indices = indices || [];
	const fragments = items.map(function (item, i) {
		Xonomy.verifyDocSpecMenuItem(item);
		const jsMe = harvest(document.getElementById(htmlID));
		const includeIt = !item.hideIf(jsMe);
		let html = "";
		if (includeIt) {
			indices.push(i);
			const icon = item.icon ? "<span class='icon'><img src='" + item.icon + "'/></span> " : "";
			const key = item.keyTrigger && item.keyCaption ? "<span class='keyCaption'>" + Xonomy.textByLang(item.keyCaption) + "</span>" : "";
			if (item.menu) {
				const internalHtml = Xonomy.internalMenu(htmlID, item.menu, harvest, getter, indices);
				if (internalHtml != "<div class='submenu'></div>") {
					html += `<div class='menuItem${item.expanded(jsMe) ? " expanded" : ""}'>`;
					html += `<div class='menuLabel focusme' tabindex='0' onkeydown='if(Xonomy.keyNav && [37, 39].indexOf(event.which)>-1) Xonomy.toggleSubmenu(this.parentNode)' onclick='Xonomy.toggleSubmenu(this.parentNode)'>${icon}${Xonomy.formatCaption(Xonomy.textByLang(item.caption(jsMe)))}</div>`;
					html += internalHtml;
					html += "</div>";
				}
			} else {
				html += `<div class='menuItem focusme' tabindex='0' onclick='Xonomy.callMenuFunction(${getter(indices)}, "${htmlID}")'>`;
				html += key + icon + Xonomy.formatCaption(Xonomy.textByLang(item.caption(jsMe)));
				html += "</div>";
			}
			indices.pop();
		}
		return html;
	});
	const cls = indices.length ? 'submenu' : 'menu';
	return fragments.length
		? `<div class='${cls}'>${fragments.join("")}</div>`
		: "";
};
Xonomy.attributeMenu = function (htmlID) {
	Xonomy.harvestCache = {};
	const elem = document.getElementById(htmlID);
	const name = elem.getAttribute("data-name"); // obtain attribute's name
	// Find closest ancestor with class 'element'
	const parentElement = elem.closest ? elem.closest('.element') : (function (node) {
		while (node && (!node.classList || !node.classList.contains('element'))) {
			node = node.parentNode;
		}
		return node;
	})(elem.parentNode);
	const elName = parentElement ? parentElement.getAttribute("data-name") : null; // obtain element's name
	Xonomy.verifyDocSpecAttribute(elName, name);
	const spec = Xonomy.docSpec.elements[elName].attributes[name];
	function getter(indices) {
		return 'Xonomy.docSpec.elements["' + elName + '"].attributes["' + name + '"].menu[' + indices.join('].menu[') + ']';
	}
	return Xonomy.internalMenu(htmlID, spec.menu, Xonomy.harvestAttribute, getter);
};
Xonomy.elementMenu = function (htmlID) {
	Xonomy.harvestCache = {};
	const elem = document.getElementById(htmlID);
	const elName = elem ? elem.getAttribute("data-name") : null; //obtain element's name
	const spec = Xonomy.docSpec.elements[elName];
	function getter(indices) {
		return `Xonomy.docSpec.elements["${elName}"].menu[${indices.join('].menu[')}]`;
	}
	return Xonomy.internalMenu(htmlID, spec.menu, Xonomy.harvestElement, getter);
};
Xonomy.inlineMenu = function (htmlID) {
	Xonomy.harvestCache = {};
	const elem = document.getElementById(htmlID);
	const elName = elem ? elem.getAttribute("data-name") : null; //obtain element's name
	const spec = Xonomy.docSpec.elements[elName];
	function getter(indices) {
		return `Xonomy.docSpec.elements["${elName}"].inlineMenu[${indices.join('].menu[')}]`;
	}
	return Xonomy.internalMenu(htmlID, spec.inlineMenu, Xonomy.harvestElement, getter);
};
Xonomy.callMenuFunction = function (menuItem, htmlID) {
	menuItem.action(htmlID, menuItem.actionParameter);
};
Xonomy.formatCaption = function (caption) {
	caption = caption.replace(/\<(\/?)([^\>\/]+)(\/?)\>/g, "<span class='techno'><span class='punc'>&lt;$1</span><span class='elName'>$2</span><span class='punc'>$3&gt;</span></span>");
	caption = caption.replace(/\@"([^\"]+)"/g, "<span class='techno'><span class='punc'>\"</span><span class='atValue'>$1</span><span class='punc'>\"</span></span>");
	caption = caption.replace(/\@([^ =]+)=""/g, "<span class='techno'><span class='atName'>$1</span><span class='punc equals'>=</span><span class='punc'>\"</span><span class='punc'>\"</span></span>");
	caption = caption.replace(/\@([^ =]+)="([^\"]+)"/g, "<span class='techno'><span class='atName'>$1</span><span class='punc equals'>=</span><span class='punc'>\"</span><span class='atValue'>$2</span><span class='punc'>\"</span></span>");
	caption = caption.replace(/\@([^ =]+)/g, "<span class='techno'><span class='atName'>$1</span></span>");
	return caption;
};

Xonomy.deleteAttribute = function (htmlID, parameter) {
	Xonomy.clickoff();
	const obj = document.getElementById(htmlID);
	const parentID = obj.parentNode.parentNode.parentNode.id;
	obj.parentNode.removeChild(obj);
	Xonomy.changed();
	window.setTimeout(function () { Xonomy.setFocus(parentID, "openingTagName"); }, 100);
};
Xonomy.deleteElement = function (htmlID, parameter) {
	Xonomy.clickoff();
	const obj = document.getElementById(htmlID);
	const parentID = obj.parentNode.parentNode.id;

	// Use fadeOut utility
	Xonomy.fadeOut(obj, 400, function () {
		const parentNode = obj.parentNode;
		parentNode.removeChild(obj);
		Xonomy.changed();
		if (!parentNode.closest('.layby')) {
			window.setTimeout(function () { Xonomy.setFocus(parentID, "openingTagName"); }, 100);
		}
	});
};
Xonomy.newAttribute = function (htmlID, parameter) {
	Xonomy.clickoff();
	const element = document.getElementById(htmlID);
	const parentName = element.getAttribute('data-name');
	const html = Xonomy.renderAttribute({ type: "attribute", name: parameter.name, value: parameter.value }, parentName);

	// Parse the HTML string and append the new attribute element
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;
	const newAttrElem = tempDiv.firstElementChild;
	const attributesContainer = element.querySelector('.tag.opening > .attributes');
	attributesContainer.appendChild(newAttrElem);

	Xonomy.changed();

	// If the attribute we have just added is shy, force rollout:
	if (attributesContainer.querySelector('[data-name="' + parameter.name + '"].shy')) {
		const tagOpening = element.querySelector('.tag.opening');
		const rollouter = tagOpening ? tagOpening.querySelector('.rollouter') : null;
		if (rollouter && !rollouter.classList.contains('rolledout')) {
			rollouter.classList.add('rolledout');
			attributesContainer.classList.add('rolledout');
			attributesContainer.style.display = 'none';
			// Simulate slideDown
			setTimeout(function () { attributesContainer.style.display = ''; }, 0);
		}
	}

	// Focus/click logic
	if (parameter.value == "") {
		Xonomy.click(newAttrElem.id, "attributeValue");
	} else {
		Xonomy.setFocus(newAttrElem.id, "attributeValue");
	}
};
Xonomy.newElementChild = function (htmlID, parameter) {
	Xonomy.clickoff();
	const jsElement = Xonomy.harvestElement(document.getElementById(htmlID));
	const html = Xonomy.renderElement(Xonomy.xml2js(parameter, jsElement));

	// Create a DOM element from the HTML string
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;
	const newElem = tempDiv.firstElementChild;
	newElem.style.opacity = 0;

	// Append to the .children container
	const parent = document.getElementById(htmlID);
	const childrenContainer = parent.querySelector('> .children');
	childrenContainer.appendChild(newElem);

	Xonomy.plusminus(htmlID, true);
	Xonomy.elementReorder(newElem.id);
	Xonomy.changed();

	// Fade in animation
	Xonomy.fadeIn(newElem, 400);

	window.setTimeout(function () { Xonomy.setFocus(newElem.id, "openingTagName"); }, 100);
};
Xonomy.elementReorder = function (htmlID) {
	const that = document.getElementById(htmlID);
	const elSpec = Xonomy.docSpec.elements[that.getAttribute("data-name")];
	// Helper to get all previous siblings with a given data-name
	function prevAllWithDataName(elem, dataName) {
		const result = [];
		let prev = elem.previousElementSibling;
		while (prev) {
			if (prev.getAttribute && prev.getAttribute("data-name") === dataName) {
				result.push(prev);
			}
			prev = prev.previousElementSibling;
		}
		return result;
	}
	// Helper to get all next siblings with a given data-name
	function nextAllWithDataName(elem, dataName) {
		const result = [];
		let next = elem.nextElementSibling;
		while (next) {
			if (next.getAttribute && next.getAttribute("data-name") === dataName) {
				result.push(next);
			}
			next = next.nextElementSibling;
		}
		return result;
	}
	if (elSpec.mustBeBefore) { //is it after an element it cannot be after? then move it up until it's not!
		var jsElement = Xonomy.harvestElement(that);
		const mustBeBefore = elSpec.mustBeBefore(jsElement);
		var ok;
		do {
			ok = true;
			for (var ii = 0; ii < mustBeBefore.length; ii++) {
				const prevs = prevAllWithDataName(that, mustBeBefore[ii]);
				if (prevs.length > 0) {
					// Move 'that' before its previous sibling
					var prev = that.previousElementSibling;
					if (prev) {
						prev.parentNode.insertBefore(that, prev);
						ok = false;
					}
				}
			}
		} while (!ok)
	}
	if (elSpec.mustBeAfter) { //is it before an element it cannot be before? then move it down until it's not!
		var jsElement = Xonomy.harvestElement(that);
		const mustBeAfter = elSpec.mustBeAfter(jsElement);
		var ok;
		do {
			ok = true;
			for (var ii = 0; ii < mustBeAfter.length; ii++) {
				const nexts = nextAllWithDataName(that, mustBeAfter[ii]);
				if (nexts.length > 0) {
					// Move 'that' after its next sibling
					var next = that.nextElementSibling;
					if (next && next.nextSibling) {
						next.parentNode.insertBefore(that, next.nextSibling);
					} else if (next) {
						next.parentNode.appendChild(that);
					}
					ok = false;
				}
			}
		} while (!ok)
	}
};
Xonomy.newElementBefore = function (htmlID, parameter) {
	Xonomy.clickoff();
	const jsElement = Xonomy.harvestElement(document.getElementById(htmlID));
	const html = Xonomy.renderElement(Xonomy.xml2js(parameter, jsElement.parent()));

	// Parse the HTML string and create the new element
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;
	const newElem = tempDiv.firstElementChild;
	newElem.style.opacity = 0;

	// Insert the new element before the target element
	const targetElem = document.getElementById(htmlID);
	targetElem.parentNode.insertBefore(newElem, targetElem);

	Xonomy.elementReorder(newElem.id);
	Xonomy.changed();

	// Fade in animation (same as newElementChild)
	Xonomy.fadeIn(newElem, 400);

	window.setTimeout(function () { Xonomy.setFocus(newElem.id, "openingTagName"); }, 100);
};
Xonomy.newElementAfter = function (htmlID, parameter) {
	Xonomy.clickoff();
	const jsElement = Xonomy.harvestElement(document.getElementById(htmlID));
	const html = Xonomy.renderElement(Xonomy.xml2js(parameter, jsElement.parent()));

	// Parse the HTML string and create the new element
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;
	const newElem = tempDiv.firstElementChild;
	newElem.style.opacity = 0;

	// Insert the new element after the target element
	const targetElem = document.getElementById(htmlID);
	if (targetElem.nextSibling) {
		targetElem.parentNode.insertBefore(newElem, targetElem.nextSibling);
	} else {
		targetElem.parentNode.appendChild(newElem);
	}

	Xonomy.elementReorder(newElem.id);
	Xonomy.changed();

	// Fade in animation (same as newElementChild)
	Xonomy.fadeIn(newElem, 400);

	window.setTimeout(function () { Xonomy.setFocus(newElem.id, "openingTagName"); }, 100);
};
Xonomy.replace = function (htmlID, jsNode) {
	const what = Xonomy.currentFocus;
	Xonomy.clickoff();
	let html = jsNode.type == "element" ? Xonomy.renderElement(jsNode) : "";
	if (jsNode.type == "attribute") html = Xonomy.renderAttribute(jsNode);
	if (jsNode.type == "text") html = Xonomy.renderText(jsNode);

	const oldElem = document.getElementById(htmlID);
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;
	const newElem = tempDiv.firstElementChild;
	if (oldElem && newElem) {
		oldElem.parentNode.replaceChild(newElem, oldElem);
	}
	Xonomy.changed();
	window.setTimeout(function () {
		if (newElem && newElem.id) {
			Xonomy.setFocus(newElem.id, what);
		}
	}, 100);
};
Xonomy.editRaw = function (htmlID, parameter) {
	const div = document.getElementById(htmlID);
	const jsElement = Xonomy.harvestElement(div);
	let txt;
	if (parameter.fromJs) txt = parameter.fromJs(jsElement);
	else if (parameter.fromXml) txt = parameter.fromXml(Xonomy.js2xml(jsElement));
	else txt = Xonomy.js2xml(jsElement);
	document.body.appendChild(Xonomy.makeBubble(Xonomy.askLongString(txt))); //create bubble
	Xonomy.showBubble(div); //anchor bubble to element
	Xonomy.answer = function (val) {
		let jsNewElement;
		if (parameter.toJs) jsNewElement = parameter.toJs(val, jsElement);
		else if (parameter.toXml) jsNewElement = Xonomy.xml2js(parameter.toXml(val, jsElement), jsElement.parent());
		else jsNewElement = Xonomy.xml2js(val, jsElement.parent());

		const obj = document.getElementById(htmlID);
		const html = Xonomy.renderElement(jsNewElement);
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = html;
		const newElem = tempDiv.firstElementChild;
		if (obj && newElem) {
			obj.parentNode.replaceChild(newElem, obj);
		}
		Xonomy.clickoff();
		Xonomy.changed();
		window.setTimeout(function () {
			Xonomy.setFocus(newElem.id, "openingTagName");
		}, 100);
	};
};
Xonomy.duplicateElement = function (htmlID) {
	Xonomy.clickoff();
	let html = document.getElementById(htmlID).outerHTML;
	const prefixID = Xonomy.nextID();
	html = html.replace(/ id=['"]/g, function (x) { return x + prefixID + "_" });
	html = html.replace(/Xonomy\.click\(['"]/g, function (x) { return x + prefixID + "_" });
	html = html.replace(/Xonomy\.plusminus\(['"]/g, function (x) { return x + prefixID + "_" });

	// Create a DOM element from the HTML string
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;
	const newElem = tempDiv.firstElementChild;
	newElem.style.opacity = 0;
	newElem.style.display = '';

	// Insert the new element after the original
	const origElem = document.getElementById(htmlID);
	if (origElem.nextSibling) {
		origElem.parentNode.insertBefore(newElem, origElem.nextSibling);
	} else {
		origElem.parentNode.appendChild(newElem);
	}

	Xonomy.changed();

	// Fade in animation (same as newElementChild)
	Xonomy.fadeIn(newElem, 400);

	window.setTimeout(function () { Xonomy.setFocus(newElem.id, "openingTagName"); }, 100);
};
Xonomy.moveElementUp = function (htmlID) {
	Xonomy.clickoff();
	const me = document.getElementById(htmlID);
	if (!me.closest('.layby > .content')) {
		Xonomy.insertDropTargets(htmlID);
		// Get all .elementDropper elements in .xonomy, then add 'me' to the end
		const droppers = Array.from(document.querySelectorAll('.xonomy .elementDropper'));
		droppers.push(me);
		// Find the index of 'me' in the array, then move it up (replace previous dropper with 'me')
		const i = droppers.indexOf(me) - 1;
		if (i >= 0) {
			const dropper = droppers[i];
			dropper.parentNode.replaceChild(me, dropper);
			Xonomy.changed();
			// Fade in animation
			Xonomy.fadeIn(me, 400);
		}
		Xonomy.dragend();
	}
	window.setTimeout(function () { Xonomy.setFocus(htmlID, "openingTagName"); }, 100);
};
Xonomy.moveElementDown = function (htmlID) {
	Xonomy.clickoff();
	const me = document.getElementById(htmlID);
	if (!me.closest('.layby > .content')) {
		Xonomy.insertDropTargets(htmlID);
		const droppers = Array.from(document.querySelectorAll('.xonomy .elementDropper'));
		droppers.push(me);
		const i = droppers.indexOf(me) + 1;
		if (i < droppers.length) {
			const dropper = droppers[i];
			dropper.parentNode.replaceChild(me, dropper);
			Xonomy.changed();
			// Fade in animation
			Xonomy.fadeIn(me, 400);
		}
		Xonomy.dragend();
	}
	window.setTimeout(function () { Xonomy.setFocus(htmlID, "openingTagName"); }, 100);
};
Xonomy.canMoveElementUp = function (htmlID) {
	let ret = false;
	const me = document.getElementById(htmlID);
	// Check if the element is inside a layby > .content
	let inLaybyContent = false;
	let parent = me.parentElement;
	while (parent) {
		if (parent.classList && parent.classList.contains('content') && parent.parentElement && parent.parentElement.classList.contains('layby')) {
			inLaybyContent = true;
			break;
		}
		parent = parent.parentElement;
	}
	if (!inLaybyContent) {
		Xonomy.insertDropTargets(htmlID);
		// Get all .elementDropper elements in .xonomy, then add 'me' to the end
		const droppers = Array.from(document.querySelectorAll('.xonomy .elementDropper'));
		droppers.push(me);
		// Find the index of 'me' in the array
		const i = droppers.indexOf(me) - 1;
		if (i >= 0) ret = true;
		Xonomy.dragend();
	}
	return ret;
};
Xonomy.canMoveElementDown = function (htmlID) {
	let ret = false;
	const me = document.getElementById(htmlID);
	// Check if the element is inside a layby > .content
	let inLaybyContent = false;
	let parent = me.parentElement;
	while (parent) {
		if (parent.classList && parent.classList.contains('content') && parent.parentElement && parent.parentElement.classList.contains('layby')) {
			inLaybyContent = true;
			break;
		}
		parent = parent.parentElement;
	}
	if (!inLaybyContent) {
		Xonomy.insertDropTargets(htmlID);
		// Get all .elementDropper elements in .xonomy, then add 'me' to the end
		const droppers = Array.from(document.querySelectorAll('.xonomy .elementDropper'));
		droppers.push(me);
		// Find the index of 'me' in the array
		const i = droppers.indexOf(me) + 1;
		if (i < droppers.length) ret = true;
		Xonomy.dragend();
	}
	return ret;
};
Xonomy.mergeWithPrevious = function (htmlID, parameter) {
	const domDead = document.getElementById(htmlID);
	const elDead = Xonomy.harvestElement(domDead);
	const elLive = elDead.getPrecedingSibling();
	Xonomy.mergeElements(elDead, elLive);
};
Xonomy.mergeWithNext = function (htmlID, parameter) {
	const domDead = document.getElementById(htmlID);
	const elDead = Xonomy.harvestElement(domDead);
	const elLive = elDead.getFollowingSibling();
	Xonomy.mergeElements(elDead, elLive);
};
Xonomy.mergeElements = function (elDead, elLive) {
	Xonomy.clickoff();
	const domDead = document.getElementById(elDead.htmlID);
	if (elLive && elLive.type == "element") {
		const domLive = document.getElementById(elLive.htmlID);
		// Merge attributes
		for (var i = 0; i < elDead.attributes.length; i++) {
			const atDead = elDead.attributes[i];
			if (!elLive.hasAttribute(atDead.name) || elLive.getAttributeValue(atDead.name) == "") {
				elLive.setAttribute(atDead.name, atDead.value);
				// Remove old attribute DOM node if it exists
				var attrObj = elLive.getAttribute(atDead.name);
				if (attrObj && attrObj.htmlID) {
					var domAttr = document.getElementById(attrObj.htmlID);
					if (domAttr) domAttr.remove();
				}
				// Move attribute DOM node from elDead to elLive
				var domAttrDead = document.getElementById(atDead.htmlID);
				if (domAttrDead && domLive) {
					var attrContainer = domLive.querySelector('.tag.opening > .attributes');
					if (attrContainer) attrContainer.appendChild(domAttrDead);
				}
			}
		}
		const specDead = Xonomy.docSpec.elements[elDead.name];
		const specLive = Xonomy.docSpec.elements[elLive.name];
		const domLiveChildren = domLive ? domLive.querySelector('.children') : null;
		if (specDead.hasText(elDead) || specLive.hasText(elLive)) { //if either element is meant to have text, concatenate their children
			if (elLive.getText() != "" && elDead.getText() != "") {
				elLive.addText(" ");
				if (domLiveChildren) {
					// Create a new text node DOM element for the space
					const tempDiv = document.createElement('div');
					tempDiv.innerHTML = Xonomy.renderText({ type: "text", value: " " });
					const spaceNode = tempDiv.firstElementChild;
					if (spaceNode) domLiveChildren.appendChild(spaceNode);
				}
			}
			for (var i = 0; i < elDead.children.length; i++) {
				elLive.children.push(elDead.children[i]);
				var childHtmlID = elDead.children[i].htmlID;
				if (childHtmlID) {
					var domChild = document.getElementById(childHtmlID);
					if (domChild && domLiveChildren) domLiveChildren.appendChild(domChild);
				}
			}
		} else { //if no text, merge their children one by one
			for (var i = 0; i < elDead.children.length; i++) {
				const xmlDeadChild = Xonomy.js2xml(elDead.children[i]);
				var has = false;
				for (let y = 0; y < elLive.children.length; y++) {
					const xmlLiveChild = Xonomy.js2xml(elLive.children[y]);
					if (xmlDeadChild == xmlLiveChild) { has = true; break; }
				}
				if (!has) {
					elLive.children.push(elDead.children[i]);
					var childHtmlID = elDead.children[i].htmlID;
					if (childHtmlID) {
						var domChild = document.getElementById(childHtmlID);
						if (domChild && domLiveChildren) domLiveChildren.appendChild(domChild);
						Xonomy.elementReorder(childHtmlID);
					}
				}
			}
		}
		if (domDead && domDead.parentNode) domDead.parentNode.removeChild(domDead);
		Xonomy.changed();
		window.setTimeout(function () { Xonomy.setFocus(elLive.htmlID, "openingTagName"); }, 100);
	} else {
		window.setTimeout(function () { Xonomy.setFocus(htmlID, "openingTagName"); }, 100);
	}
};
Xonomy.deleteEponymousSiblings = function (htmlID, parameter) {
	const what = Xonomy.currentFocus;
	Xonomy.clickoff();
	const obj = document.getElementById(htmlID);
	const parent = obj.parentNode.parentNode;
	// Find the .children container inside parent
	const childrenContainer = parent.querySelector('.children');
	if (!childrenContainer) return;
	// Convert childNodes to array for safe iteration
	const htmlChildren = Array.prototype.slice.call(childrenContainer.childNodes);
	for (let i = 0; i < htmlChildren.length; i++) {
		const htmlChild = htmlChildren[i];
		if (htmlChild.nodeType === 1 && htmlChild.classList.contains('element')) {
			if (htmlChild.getAttribute('data-name') === obj.getAttribute('data-name') && htmlChild !== obj) {
				htmlChild.parentNode.removeChild(htmlChild);
			}
		}
	}
	Xonomy.changed();
	window.setTimeout(function () { Xonomy.setFocus(htmlID, what); }, 100);
};

Xonomy.insertDropTargets = function (htmlID) {
	const element = document.getElementById(htmlID);
	element.classList.add("dragging");
	const elementName = element.getAttribute("data-name");
	const elSpec = Xonomy.docSpec.elements[elementName];

	// Helper: check if element is visible
	function isVisible(el) {
		return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
	}

	// Helper: insert dropper before a node
	function insertDropperBefore(node) {
		const dropper = document.createElement('div');
		dropper.className = 'elementDropper';
		dropper.setAttribute('ondragover', 'Xonomy.dragOver(event)');
		dropper.setAttribute('ondragleave', 'Xonomy.dragOut(event)');
		dropper.setAttribute('ondrop', 'Xonomy.drop(event)');
		const inside = document.createElement('div');
		inside.className = 'inside';
		dropper.appendChild(inside);
		node.parentNode.insertBefore(dropper, node);
	}

	// Helper: append dropper to a node
	function appendDropperTo(node) {
		const dropper = document.createElement('div');
		dropper.className = 'elementDropper';
		dropper.setAttribute('ondragover', 'Xonomy.dragOver(event)');
		dropper.setAttribute('ondragleave', 'Xonomy.dragOut(event)');
		dropper.setAttribute('ondrop', 'Xonomy.drop(event)');
		const inside = document.createElement('div');
		inside.className = 'inside';
		dropper.appendChild(inside);
		node.appendChild(dropper);
	}

	// 1. Append dropper to all .xonomy .element > .children (if visible)
	document.querySelectorAll('.xonomy .element > .children').forEach(children => {
		if (isVisible(children)) {
			appendDropperTo(children);
		}
	});
	// 2. Insert dropper before all .xonomy .element > .children > .element (if visible)
	document.querySelectorAll('.xonomy .element > .children > .element').forEach(child => {
		if (isVisible(child)) {
			insertDropperBefore(child);
		}
	});
	// 3. Insert dropper before all .xonomy .element > .children > .text (if visible)
	document.querySelectorAll('.xonomy .element > .children > .text').forEach(child => {
		if (isVisible(child)) {
			insertDropperBefore(child);
		}
	});
	// 4. Remove drop targets from inside the element being dragged
	element.querySelectorAll('.children > .elementDropper').forEach(dropper => dropper.remove());
	// 5. Remove drop targets from immediately before and after the element being dragged
	if (element.previousElementSibling && element.previousElementSibling.classList.contains('elementDropper')) {
		element.previousElementSibling.remove();
	}
	if (element.nextElementSibling && element.nextElementSibling.classList.contains('elementDropper')) {
		element.nextElementSibling.remove();
	}
	// 6. Remove drop targets from inside read-only elements
	document.querySelectorAll('.xonomy .children > .element.readonly .elementDropper').forEach(dropper => dropper.remove());

	// Helper: harvest cache for localDropOnly, mustBeBefore, mustBeAfter
	const harvestCache = {};
	const harvestElement = function (div) {
		const htmlID = div.id;
		if (!harvestCache[htmlID]) harvestCache[htmlID] = Xonomy.harvestElement(div);
		return harvestCache[htmlID];
	};

	// 7. If localDropOnly, remove drop targets from elements that are not the dragged element's parent
	if (elSpec.localDropOnly(harvestElement(element))) {
		if (elSpec.canDropTo) {
			const droppers = Array.from(document.querySelectorAll('.xonomy .elementDropper'));
			droppers.forEach(dropper => {
				// Find the parent .element of the dropper
				let parent = dropper.parentNode;
				while (parent && !parent.classList.contains('element')) {
					parent = parent.parentNode;
				}
				if (parent && parent !== element.parentNode.parentNode) {
					dropper.remove();
				}
			});
		}
	}
	// 8. Remove drop targets from elements it cannot be dropped into
	if (elSpec.canDropTo) {
		const droppers = Array.from(document.querySelectorAll('.xonomy .elementDropper'));
		droppers.forEach(dropper => {
			let parent = dropper.parentNode;
			while (parent && !parent.classList.contains('element')) {
				parent = parent.parentNode;
			}
			if (parent) {
				const parentElementName = parent.getAttribute('data-name');
				if (elSpec.canDropTo.indexOf(parentElementName) < 0) {
					dropper.remove();
				}
			}
		});
	}
	// Helper: get all previous siblings with data-name
	function prevAllWithDataName(elem, dataName) {
		const result = [];
		let prev = elem.previousElementSibling;
		while (prev) {
			if (prev.getAttribute && prev.getAttribute('data-name') === dataName) {
				result.push(prev);
			}
			prev = prev.previousElementSibling;
		}
		return result;
	}
	// Helper: get all next siblings with data-name
	function nextAllWithDataName(elem, dataName) {
		const result = [];
		let next = elem.nextElementSibling;
		while (next) {
			if (next.getAttribute && next.getAttribute('data-name') === dataName) {
				result.push(next);
			}
			next = next.nextElementSibling;
		}
		return result;
	}
	// 9. Remove drop targets from after elements it cannot be after
	if (elSpec.mustBeBefore) {
		var jsElement = harvestElement(element);
		const droppers = Array.from(document.querySelectorAll('.xonomy .elementDropper'));
		droppers.forEach(dropper => {
			jsElement.internalParent = harvestElement(dropper.parentNode.parentNode); // pretend the element's parent is the dropper's parent
			const mustBeBefore = elSpec.mustBeBefore(jsElement);
			for (let ii = 0; ii < mustBeBefore.length; ii++) {
				if (prevAllWithDataName(dropper, mustBeBefore[ii]).length > 0) {
					dropper.remove();
					break;
				}
			}
		});
	}
	// 10. Remove drop targets from before elements it cannot be before
	if (elSpec.mustBeAfter) {
		var jsElement = harvestElement(element);
		const droppers = Array.from(document.querySelectorAll('.xonomy .elementDropper'));
		droppers.forEach(dropper => {
			jsElement.internalParent = harvestElement(dropper.parentNode.parentNode); // pretend the element's parent is the dropper's parent
			const mustBeAfter = elSpec.mustBeAfter(jsElement);
			for (let ii = 0; ii < mustBeAfter.length; ii++) {
				if (nextAllWithDataName(dropper, mustBeAfter[ii]).length > 0) {
					dropper.remove();
					break;
				}
			}
		});
	}
};

Xonomy.draggingID = null; //what are we dragging?
Xonomy.drag = function (ev) { //called when dragging starts
	// Wrapping all the code into a timeout handler is a workaround for a Chrome browser bug
	// (if the DOM is manipulated in the 'dragStart' event then 'dragEnd' event is sometimes fired immediately)
	//
	// for more details @see:
	//   http://stackoverflow.com/questions/19639969/html5-dragend-event-firing-immediately
	ev.dataTransfer.effectAllowed = "move"; //only allow moving (and not eg. copying]
	const htmlID = ev.target.parentNode.parentNode.id;
	ev.dataTransfer.setData("text", htmlID);
	setTimeout(function () {
		Xonomy.clickoff();
		Xonomy.insertDropTargets(htmlID);
		Xonomy.draggingID = htmlID;
		Xonomy.refresh();
	}, 10);
};
Xonomy.dragOver = function (ev) {
	ev.preventDefault();
	ev.dataTransfer.dropEffect = "move"; //only allow moving (and not eg. copying]
	if (ev.currentTarget.classList.contains("layby")) {
		ev.currentTarget.classList.add("activeDropper");
	} else {
		ev.target.parentNode.classList.add("activeDropper");
	}
};
Xonomy.dragOut = function (ev) {
	ev.preventDefault();
	if (ev.currentTarget.classList.contains("layby")) {
		ev.currentTarget.classList.remove("activeDropper");
	} else {
		// Remove 'activeDropper' from all elements inside .xonomy
		const activeDroppers = document.querySelectorAll(".xonomy .activeDropper");
		activeDroppers.forEach(function (el) {
			el.classList.remove("activeDropper");
		});
	}
};
Xonomy.drop = function (ev) {
	ev.preventDefault();
	const node = document.getElementById(Xonomy.draggingID); //the thing we are moving
	if (ev.currentTarget.classList.contains("layby")) {
		// Hide node (for fade-in)
		node.style.opacity = 0;
		node.style.display = "";
		// Append to layby content
		const laybyContent = document.querySelector(".xonomy .layby > .content");
		if (laybyContent) laybyContent.appendChild(node);
		// Fade in animation
		Xonomy.fadeIn(node, 400, function () { Xonomy.changed(); });
	} else {
		// Hide node (for fade-in)
		node.style.opacity = 0;
		node.style.display = "";
		// Replace drop target's parent with node
		const targetParent = ev.target.parentNode;
		if (targetParent && targetParent.parentNode) {
			targetParent.parentNode.replaceChild(node, targetParent);
		}
		// Fade in animation
		Xonomy.fadeIn(node, 400, function () { Xonomy.changed(); });
	}
	Xonomy.openCloseLayby();
	Xonomy.recomputeLayby();
};
Xonomy.dragend = function (ev) {
	// Remove all .attributeDropper elements
	document.querySelectorAll('.xonomy .attributeDropper').forEach(function (el) {
		el.remove();
	});
	// Remove all .elementDropper elements
	document.querySelectorAll('.xonomy .elementDropper').forEach(function (el) {
		el.remove();
	});
	// Remove the 'dragging' class from all elements with it
	document.querySelectorAll('.xonomy .dragging').forEach(function (el) {
		el.classList.remove('dragging');
	});
	Xonomy.refresh();
	// Remove the 'activeDropper' class from all .layby elements
	document.querySelectorAll('.xonomy .layby').forEach(function (el) {
		el.classList.remove('activeDropper');
	});
};

Xonomy.openCloseLayby = function () { //open the layby if it's full, close it if it's empty
	const laybyContentChildren = document.querySelectorAll('.xonomy .layby > .content > *');
	const laybyElements = document.querySelectorAll('.xonomy .layby');
	if (laybyContentChildren.length > 0) {
		laybyElements.forEach(function (el) {
			el.classList.remove('closed');
			el.classList.add('open');
		});
	} else {
		laybyElements.forEach(function (el) {
			el.classList.remove('open');
			el.classList.add('closed');
		});
	}
};
Xonomy.openLayby = function () {
	const laybys = document.querySelectorAll('.xonomy .layby');
	laybys.forEach(function (layby) {
		layby.classList.remove('closed');
		layby.classList.add('open');
	});
};
Xonomy.closeLayby = function () {
	window.setTimeout(function () {
		const laybys = document.querySelectorAll('.xonomy .layby');
		laybys.forEach(function (layby) {
			layby.classList.remove('open');
			layby.classList.add('closed');
		});
	}, 10);
};
Xonomy.emptyLayby = function () {
	// Clear the content of all .xonomy .layby .content elements
	const contents = document.querySelectorAll('.xonomy .layby .content');
	contents.forEach(function (content) {
		content.innerHTML = '';
	});
	// Update classes on all .xonomy .layby elements
	const laybys = document.querySelectorAll('.xonomy .layby');
	laybys.forEach(function (layby) {
		layby.classList.remove('nonempty');
		layby.classList.add('empty');
	});
};
Xonomy.recomputeLayby = function () {
	const laybyContentChildren = document.querySelectorAll('.xonomy .layby > .content > *');
	const laybyElements = document.querySelectorAll('.xonomy .layby');
	if (laybyContentChildren.length > 0) {
		laybyElements.forEach(function (el) {
			el.classList.remove('empty');
			el.classList.add('nonempty');
		});
	} else {
		laybyElements.forEach(function (el) {
			el.classList.remove('nonempty');
			el.classList.add('empty');
		});
	}
}
Xonomy.newElementLayby = function (xml) {
	Xonomy.clickoff();
	const html = Xonomy.renderElement(Xonomy.xml2js(xml));
	// Create a DOM element from the HTML string
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;
	const newElem = tempDiv.firstElementChild;
	newElem.style.opacity = 0;
	newElem.style.display = '';

	// Append to the layby content
	const laybyContent = document.querySelector('.xonomy .layby > .content');
	if (laybyContent) laybyContent.appendChild(newElem);

	Xonomy.refresh();

	// Fade in animation (same as other new element functions)
	Xonomy.fadeIn(newElem, 400);

	Xonomy.openCloseLayby();
	Xonomy.recomputeLayby();
};

Xonomy.changed = function (jsElement) { //called when the document changes
	Xonomy.harvestCache = {};
	Xonomy.refresh();
	Xonomy.validate();
	Xonomy.docSpec.onchange(jsElement); //report that the document has changed
};
Xonomy.validate = function () {
	// Get the first .xonomy .element
	const rootElement = document.querySelector('.xonomy .element');
	const js = Xonomy.harvestElement(rootElement, null);
	// Remove 'invalid' class from all elements with it
	document.querySelectorAll('.xonomy .invalid').forEach(function (el) {
		el.classList.remove('invalid');
	});
	Xonomy.warnings = [];
	Xonomy.docSpec.validate(js); //validate the document
	for (let iWarning = 0; iWarning < Xonomy.warnings.length; iWarning++) {
		const warning = Xonomy.warnings[iWarning];
		const warnElem = document.getElementById(warning.htmlID);
		if (warnElem) warnElem.classList.add('invalid');
	}
};
Xonomy.warnings = []; //array of {htmlID: "", text: ""}

Xonomy.textByLang = function (str) {
	//str = eg. "en: Delete | de: Löschen | fr: Supprimer"
	if (!str) str = "";
	let ret = str;
	const segs = str.split("|");
	for (let i = 0; i < segs.length; i++) {
		const seg = segs[i].trim();
		if (seg.indexOf(Xonomy.lang + ":") == 0) {
			ret = seg.substring((Xonomy.lang + ":").length, ret.length);
		}
	}
	ret = ret.trim();
	return ret;
};

Xonomy.currentHtmlId = null;
Xonomy.currentFocus = null;
Xonomy.keyNav = false;
Xonomy.startKeyNav = function (keyboardEventCatcher, scrollableContainer) {
	Xonomy.keyNav = true;
	// Resolve keyboardEventCatcher
	let keyboardCatcherElem = null;
	if (keyboardEventCatcher instanceof Element) {
		keyboardCatcherElem = keyboardEventCatcher;
	} else if (typeof keyboardEventCatcher === "string" && keyboardEventCatcher.trim() !== "") {
		keyboardCatcherElem = document.querySelector(keyboardEventCatcher);
	}
	if (!keyboardCatcherElem) keyboardCatcherElem = document.querySelector(".xonomy");

	// Resolve scrollableContainer
	let scrollableElem = null;
	if (scrollableContainer instanceof Element) {
		scrollableElem = scrollableContainer;
	} else if (typeof scrollableContainer === "string" && scrollableContainer.trim() !== "") {
		scrollableElem = document.querySelector(scrollableContainer);
	}
	if (!scrollableElem) scrollableElem = keyboardCatcherElem;

	// Set tabindex
	if (keyboardCatcherElem) keyboardCatcherElem.setAttribute("tabindex", "0");

	// Remove previous event listener if any (to avoid duplicates)
	if (keyboardCatcherElem) {
		keyboardCatcherElem.removeEventListener("keydown", Xonomy.key);
		keyboardCatcherElem.addEventListener("keydown", Xonomy.key);
	}

	// Remove previous document keydown handler if any
	if (Xonomy._docKeydownHandler) document.removeEventListener("keydown", Xonomy._docKeydownHandler);
	Xonomy._docKeydownHandler = function (e) {
		const isArrowOrSpace = [32, 37, 38, 39, 40].indexOf(e.keyCode) > -1;
		const active = document.activeElement;
		const isInputFocused = active && (
			active.tagName === "INPUT" ||
			active.tagName === "SELECT" ||
			active.tagName === "TEXTAREA"
		);
		if (isArrowOrSpace && !isInputFocused) {
			e.preventDefault();
		}
	};
	document.addEventListener("keydown", Xonomy._docKeydownHandler);

	Xonomy.keyboardEventCatcher = keyboardCatcherElem;
	Xonomy.scrollableContainer = scrollableElem;
};
Xonomy.setFocus = function (htmlID, what) {
	if (Xonomy.keyNav) {
		// Remove 'current' and 'focused' classes from all relevant elements
		document.querySelectorAll('.xonomy .current').forEach(function (el) {
			el.classList.remove('current');
		});
		document.querySelectorAll('.xonomy .focused').forEach(function (el) {
			el.classList.remove('focused');
		});
		if (what == "attributeValue") {
			const valueContainer = document.querySelector(`#${CSS.escape(htmlID)} > .valueContainer`);
			if (valueContainer) {
				valueContainer.classList.add('current', 'focused');
			}
		} else {
			const mainElem = document.getElementById(htmlID);
			if (mainElem) {
				mainElem.classList.add('current', 'focused');
			}
		}
		Xonomy.currentHtmlId = htmlID;
		Xonomy.currentFocus = what;
		if (Xonomy.currentFocus == "openingTagName") {
			const opening = document.querySelector(`#${CSS.escape(htmlID)} > .tag.opening`);
			if (opening) opening.classList.add('focused');
		}
		if (Xonomy.currentFocus == "closingTagName") {
			const closings = document.querySelectorAll(`#${CSS.escape(htmlID)} > .tag.closing`);
			if (closings.length > 0) closings[closings.length - 1].classList.add('focused');
		}
		if (Xonomy.currentFocus == "childrenCollapsed") {
			const childrenCollapsed = document.querySelectorAll(`#${CSS.escape(htmlID)} > .childrenCollapsed`);
			if (childrenCollapsed.length > 0) childrenCollapsed[childrenCollapsed.length - 1].classList.add('focused');
		}
		if (Xonomy.currentFocus == "rollouter") {
			const rollouters = document.querySelectorAll(`#${CSS.escape(htmlID)} > .tag.opening > .rollouter`);
			if (rollouters.length > 0) rollouters[rollouters.length - 1].classList.add('focused');
		}
	}
};
Xonomy.key = function (event) {
	if (!Xonomy.notKeyUp) {
		if (!event.shiftKey && !(document.getElementById("xonomyBubble"))) {
			if (event.key === "Escape" || event.keyCode === 27) { //escape key
				event.preventDefault();
				event.stopImmediatePropagation();
				Xonomy.destroyBubble();
			} else if (event.key === "Enter" || event.keyCode === 13) { //enter key
				event.preventDefault();
				event.stopImmediatePropagation();
				if (Xonomy.currentFocus == "childrenCollapsed") Xonomy.plusminus(Xonomy.currentHtmlId, true);
				if (Xonomy.currentFocus == "char") {
					var charElem = document.getElementById(Xonomy.currentHtmlId);
					if (charElem) Xonomy.charClick(charElem);
				}
				else {
					Xonomy.click(Xonomy.currentHtmlId, Xonomy.currentFocus);
					Xonomy.clickoff();
				}
			} else if ((event.ctrlKey || event.metaKey) && (event.key === "ArrowDown" || event.keyCode === 40)) { //down key with Ctrl or Cmd (Mac OS)
				event.preventDefault();
				event.stopImmediatePropagation();
				if (Xonomy.scrollableContainer && typeof Xonomy.scrollableContainer.scrollTop === "number") {
					Xonomy.scrollableContainer.scrollTop = Xonomy.scrollableContainer.scrollTop + 60;
				}
			} else if ((event.ctrlKey || event.metaKey) && (event.key === "ArrowUp" || event.keyCode === 38)) { //up key with Ctrl or Cmd (Mac OS)
				event.preventDefault();
				event.stopImmediatePropagation();
				if (Xonomy.scrollableContainer && typeof Xonomy.scrollableContainer.scrollTop === "number") {
					Xonomy.scrollableContainer.scrollTop = Xonomy.scrollableContainer.scrollTop - 60;
				}
			} else if ((event.ctrlKey || event.metaKey) && (["ArrowLeft", "ArrowRight"].indexOf(event.key) > -1 || [37, 39].indexOf(event.keyCode) > -1)) { //arrow keys with Ctrl or Cmd (Mac OS)
				event.preventDefault();
				event.stopImmediatePropagation();
				const el = document.getElementById(Xonomy.currentHtmlId);
				if (el && el.classList.contains("element") && !el.classList.contains("uncollapsible")) {
					if ((event.key === "ArrowRight" || event.keyCode === 39) && el.classList.contains("collapsed")) { //expand it!
						Xonomy.plusminus(Xonomy.currentHtmlId);
					}
					if ((event.key === "ArrowLeft" || event.keyCode === 37) && !el.classList.contains("collapsed")) { //collapse it!
						Xonomy.plusminus(Xonomy.currentHtmlId);
					}
				}
			} else if ((["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].indexOf(event.key) > -1 || [37, 38, 39, 40].indexOf(event.keyCode) > -1) && !event.altKey) { //arrow keys
				event.preventDefault();
				event.stopImmediatePropagation();
				if (!Xonomy.currentHtmlId) { //nothing is current yet
					const firstElem = document.querySelector(".xonomy .element");
					if (firstElem) Xonomy.setFocus(firstElem.id, "openingTagName");
				} else if (document.querySelectorAll(".xonomy .focused").length === 0) { //something is current but nothing is focused yet
					Xonomy.setFocus(Xonomy.currentHtmlId, Xonomy.currentFocus);
				} else { //something is current, do arrow action
					if (event.key === "ArrowDown" || event.keyCode === 40) Xonomy.goDown(); //down key
					if (event.key === "ArrowUp" || event.keyCode === 38) Xonomy.goUp(); //up key
					if (event.key === "ArrowRight" || event.keyCode === 39) Xonomy.goRight(); //right key
					if (event.key === "ArrowLeft" || event.keyCode === 37) Xonomy.goLeft(); //left key
				}
			}
		} else if (!(document.getElementById("xonomyBubble"))) {
			Xonomy.keyboardMenu(event);
		}
	}
	Xonomy.notKeyUp = false;
};
Xonomy.keyboardMenu = function (event) {
	Xonomy.harvestCache = {};
	const obj = document.getElementById(Xonomy.currentHtmlId);
	let jsMe = null;
	let menu = null;
	if (!obj) return false;
	if (obj.classList.contains("element")) {
		jsMe = Xonomy.harvestElement(obj);
		var elName = obj.getAttribute("data-name");
		menu = Xonomy.docSpec.elements[elName].menu;
	} else if (obj.classList.contains("attribute")) {
		jsMe = Xonomy.harvestAttribute(obj);
		const atName = obj.getAttribute("data-name");
		// Find closest ancestor with class 'element'
		let parent = obj.parentElement;
		while (parent && (!parent.classList || !parent.classList.contains('element'))) {
			parent = parent.parentElement;
		}
		var elName = parent ? parent.getAttribute("data-name") : null;
		menu = Xonomy.docSpec.elements[elName].attributes[atName].menu;
	}
	if (menu) {
		Xonomy.harvestCache = {};
		var findMenuItem = function (menu) {
			let ret = null;
			for (let i = 0; i < menu.length; i++) {
				if (menu[i].menu) ret = findMenuItem(menu[i].menu);
				else if (menu[i].keyTrigger && !menu[i].hideIf(jsMe) && menu[i].keyTrigger(event)) ret = menu[i];
				if (ret) break;
			}
			return ret;
		};
		const menuItem = findMenuItem(menu);
		if (menuItem) {
			Xonomy.callMenuFunction(menuItem, Xonomy.currentHtmlId);
			Xonomy.clickoff();
			return true;
		}
	}
	return false;
};

Xonomy.goDown = function () {
	if (Xonomy.currentFocus != "openingTagName" && Xonomy.currentFocus != "closingTagName" && Xonomy.currentFocus != "text" && Xonomy.currentFocus != "char") {
		Xonomy.goRight();
	} else {
		const el = document.getElementById(Xonomy.currentHtmlId);
		let me = el;
		if (Xonomy.currentFocus == "openingTagName") {
			me = el.querySelector('.tag.opening');
		}
		if (Xonomy.currentFocus == "closingTagName") {
			const closings = el.querySelectorAll('.tag.closing');
			me = closings[closings.length - 1];
		}

		// Get all .xonomy .focusable:visible
		const allCandidates = Array.from(document.querySelectorAll('.xonomy .focusable'));
		let candidates = allCandidates.filter(function (c) {
			// Only visible elements
			return c.offsetParent !== null;
		});
		// Remove .attributeName, .attributeValue, .childrenCollapsed, .rollouter
		candidates = candidates.filter(function (c) {
			return !c.classList.contains('attributeName') &&
				!c.classList.contains('attributeValue') &&
				!c.classList.contains('childrenCollapsed') &&
				!c.classList.contains('rollouter');
		});
		// Remove .char, but add el itself
		candidates = candidates.filter(function (c) { return !c.classList.contains('char'); });
		if (!candidates.includes(el)) candidates.push(el);

		// If openingTagName and oneliner, remove .tag.closing and .children * and .textnode inside this element
		if (Xonomy.currentFocus == "openingTagName" && el.classList.contains("oneliner")) {
			const toRemove = el.querySelectorAll('.tag.closing, .children *');
			candidates = candidates.filter(function (c) {
				return !Array.from(toRemove).includes(c);
			});
			const textnodes = el.querySelectorAll('.textnode');
			candidates = candidates.filter(function (c) {
				return !Array.from(textnodes).includes(c);
			});
		}
		// Remove .prominentChildren *
		if (Xonomy.currentFocus == "openingTagName") {
			const promChildren = el.querySelectorAll('.prominentChildren *');
			candidates = candidates.filter(function (c) {
				return !Array.from(promChildren).includes(c);
			});
		}
		// If collapsed, remove .tag.closing inside this element
		if (el.classList.contains("collapsed")) {
			var tagClosings = el.querySelectorAll('.tag.closing');
			candidates = candidates.filter(function (c) {
				return !Array.from(tagClosings).includes(c);
			});
		}
		// If textnode and not in .prominentChildren and .xonomy has class nerd, jump to last .tag.closing in closest .element
		if (el.classList.contains("textnode") && !(el.closest('.prominentChildren')) && document.querySelector('.xonomy').classList.contains('nerd')) {
			var closestElement = el.closest('.element');
			var tagClosings = closestElement ? closestElement.querySelectorAll('.tag.closing') : [];
			const visibleTagClosings = Array.from(tagClosings).filter(function (c) { return c.offsetParent !== null; });
			if (visibleTagClosings.length > 0) {
				const last = visibleTagClosings[visibleTagClosings.length - 1];
				candidates = [last];
			}
		}
		// If textnode and .xonomy has class laic, jump to first .focusable:visible in next .element
		if (el.classList.contains("textnode") && document.querySelector('.xonomy').classList.contains('laic')) {
			var closestElement = el.closest('.element');
			const nextElement = closestElement ? closestElement.nextElementSibling : null;
			if (nextElement) {
				const nextFocusables = Array.from(nextElement.querySelectorAll('.focusable')).filter(function (c) { return c.offsetParent !== null; });
				if (nextFocusables.length > 0) {
					candidates = [nextFocusables[0]];
				}
			}
		}
		// Find index of me in candidates
		const idx = candidates.indexOf(me);
		const next = candidates[idx + 1];
		if (next) {
			if (next.classList.contains("opening")) Xonomy.setFocus(next.closest(".element").id, "openingTagName");
			else if (next.classList.contains("closing")) Xonomy.setFocus(next.closest(".element").id, "closingTagName");
			else if (next.classList.contains("textnode")) Xonomy.setFocus(next.id, "text");
		}
	}
};
Xonomy.goUp = function () {
	if (Xonomy.currentFocus != "openingTagName" && Xonomy.currentFocus != "closingTagName" && Xonomy.currentFocus != "char" && Xonomy.currentFocus != "text") {
		Xonomy.goLeft();
	} else {
		const el = document.getElementById(Xonomy.currentHtmlId);
		let me = el;
		if (Xonomy.currentFocus == "openingTagName") {
			var opening = el.querySelector('.tag.opening');
			if (opening) me = opening;
		}
		if (Xonomy.currentFocus == "closingTagName") {
			const closings = el.querySelectorAll('.tag.closing');
			if (closings.length > 0) me = closings[closings.length - 1];
		}

		// Get all .xonomy .focusable:visible
		const allCandidates = Array.from(document.querySelectorAll('.xonomy .focusable'));
		let candidates = allCandidates.filter(function (c) {
			return c.offsetParent !== null;
		});
		// Remove .attributeName, .attributeValue, .childrenCollapsed, .rollouter
		candidates = candidates.filter(function (c) {
			return !c.classList.contains('attributeName') &&
				!c.classList.contains('attributeValue') &&
				!c.classList.contains('childrenCollapsed') &&
				!c.classList.contains('rollouter');
		});
		// Remove .element .oneliner .tag.closing
		candidates = candidates.filter(function (c) {
			const parent = c.closest('.element.oneliner');
			return !(parent && c.classList.contains('tag') && c.classList.contains('closing'));
		});
		// Remove .element .oneliner .textnode
		candidates = candidates.filter(function (c) {
			const parent = c.closest('.element.oneliner');
			return !(parent && c.classList.contains('textnode'));
		});
		// Remove .element .collapsed .tag.closing
		candidates = candidates.filter(function (c) {
			const parent = c.closest('.element.collapsed');
			return !(parent && c.classList.contains('tag') && c.classList.contains('closing'));
		});
		// Remove .char
		candidates = candidates.filter(function (c) { return !c.classList.contains('char'); });

		// If el is .char, set candidates to closest .textnode and el
		if (el.classList.contains('char')) {
			const textnode = el.closest('.textnode');
			if (textnode) candidates = [textnode, el];
		}
		// If el is .textnode and in .prominentChildren, add all .xonomy .prominentChildren .textnode
		if (el.classList.contains('textnode') && el.closest('.prominentChildren')) {
			const promTextnodes = Array.from(document.querySelectorAll('.xonomy .prominentChildren .textnode'));
			candidates = candidates.concat(promTextnodes);
		}
		// If el is .textnode and not in .prominentChildren, set candidates to closest .element .tag.opening and el
		if (el.classList.contains('textnode') && !el.closest('.prominentChildren')) {
			const closestElement = el.closest('.element');
			var opening = closestElement ? closestElement.querySelector('.tag.opening') : null;
			if (opening) candidates = [opening, el];
		}
		// If me is .closing and el is .hasText, remove all children except first from el's .children
		if (me.classList.contains('closing') && el.classList.contains('hasText')) {
			const children = el.querySelector('.children');
			if (children) {
				var notFirst = Array.from(children.children).slice(1);
				candidates = candidates.filter(function (c) {
					return !notFirst.includes(c);
				});
			}
		}
		// If me is .opening and previous .element has .hasText, remove all children except first from that element's .children
		if (me.classList.contains('opening')) {
			const prevElement = el.closest('.element');
			if (prevElement && prevElement.previousElementSibling && prevElement.previousElementSibling.classList.contains('element') && prevElement.previousElementSibling.classList.contains('hasText')) {
				const siblingID = prevElement.previousElementSibling.id;
				const siblingChildren = prevElement.previousElementSibling.querySelector('.children');
				if (siblingChildren) {
					var notFirst = Array.from(siblingChildren.children).slice(1);
					candidates = candidates.filter(function (c) {
						return !notFirst.includes(c);
					});
				}
			}
		}
		// Always add me to candidates if not present
		if (!candidates.includes(me)) candidates.push(me);

		// Find index of me in candidates
		const idx = candidates.indexOf(me);
		if (idx > 0) {
			const next = candidates[idx - 1];
			if (next.classList.contains("opening")) Xonomy.setFocus(next.closest(".element").id, "openingTagName");
			else if (next.classList.contains("closing")) Xonomy.setFocus(next.closest(".element").id, "closingTagName");
			else if (next.classList.contains("textnode")) Xonomy.setFocus(next.id, "text");
		}
	}
};
Xonomy.goRight = function () {
	const el = document.getElementById(Xonomy.currentHtmlId);
	let me = el;
	if (Xonomy.currentFocus == "openingTagName") {
		const opening = el.querySelector(".tag.opening");
		if (opening) me = opening;
	}
	if (Xonomy.currentFocus == "closingTagName") {
		const closings = el.querySelectorAll(".tag.closing");
		if (closings.length > 0) me = closings[closings.length - 1];
	}
	if (Xonomy.currentFocus == "attributeName") {
		const attrName = el.querySelector(".attributeName");
		if (attrName) me = attrName;
	}
	if (Xonomy.currentFocus == "attributeValue") {
		const attrValue = el.querySelector(".attributeValue");
		if (attrValue) me = attrValue;
	}
	if (Xonomy.currentFocus == "childrenCollapsed") {
		// .childrenCollapsed but not inside .prominentChildren
		const all = Array.from(el.querySelectorAll(":scope > .childrenCollapsed"));
		const filtered = all.filter(function (c) {
			return !c.closest(".prominentChildren");
		});
		if (filtered.length > 0) me = filtered[0];
	}
	if (Xonomy.currentFocus == "rollouter") {
		const rollouter = el.querySelector(".rollouter");
		if (rollouter) me = rollouter;
	}

	// Get all .xonomy .focusable:visible
	const allCandidates = Array.from(document.querySelectorAll('.xonomy .focusable'));
	let candidates = allCandidates.filter(function (c) {
		return c.offsetParent !== null;
	});
	// Remove .char
	candidates = candidates.filter(function (c) { return !c.classList.contains('char'); });
	// Add visible .char inside .hasInlineMenu > .children > .textnode
	let chars = Array.from(document.querySelectorAll('.hasInlineMenu > .children > .textnode .char'));
	chars = chars.filter(function (c) { return c.offsetParent !== null; });
	candidates = candidates.concat(chars);

	// Find index of me in candidates
	const idx = candidates.indexOf(me);
	const next = candidates[idx + 1];
	if (next) {
		if (next.classList.contains("attributeName")) Xonomy.setFocus(next.closest(".attribute").id, "attributeName");
		else if (next.classList.contains("attributeValue")) Xonomy.setFocus(next.closest(".attribute").id, "attributeValue");
		else if (next.classList.contains("opening")) Xonomy.setFocus(next.closest(".element").id, "openingTagName");
		else if (next.classList.contains("closing")) Xonomy.setFocus(next.closest(".element").id, "closingTagName");
		else if (next.classList.contains("textnode")) Xonomy.setFocus(next.id, "text");
		else if (next.classList.contains("childrenCollapsed")) Xonomy.setFocus(next.closest(".element").id, "childrenCollapsed");
		else if (next.classList.contains("rollouter")) Xonomy.setFocus(next.closest(".element").id, "rollouter");
		else if (next.classList.contains("char")) Xonomy.setFocus(next.id, "char");
	}
};
Xonomy.goLeft = function () {
	const el = document.getElementById(Xonomy.currentHtmlId);
	let me = el;
	if (Xonomy.currentFocus == "openingTagName") {
		const opening = el.querySelector(".tag.opening");
		if (opening) me = opening;
	}
	if (Xonomy.currentFocus == "closingTagName") {
		const closings = el.querySelectorAll(".tag.closing");
		if (closings.length > 0) me = closings[closings.length - 1];
	}
	if (Xonomy.currentFocus == "attributeName") {
		const attrName = el.querySelector(".attributeName");
		if (attrName) me = attrName;
	}
	if (Xonomy.currentFocus == "attributeValue") {
		const attrValue = el.querySelector(".attributeValue");
		if (attrValue) me = attrValue;
	}
	if (Xonomy.currentFocus == "childrenCollapsed") {
		// .childrenCollapsed but not inside .prominentChildren
		const all = Array.from(el.querySelectorAll(":scope > .childrenCollapsed"));
		const filtered = all.filter(function (c) {
			return !c.closest(".prominentChildren");
		});
		if (filtered.length > 0) me = filtered[0];
	}
	if (Xonomy.currentFocus == "rollouter") {
		const rollouter = el.querySelector(".rollouter");
		if (rollouter) me = rollouter;
	}

	// Get all .xonomy .focusable:visible
	const allCandidates = Array.from(document.querySelectorAll('.xonomy .focusable'));
	let candidates = allCandidates.filter(function (c) {
		return c.offsetParent !== null;
	});
	// Remove .char
	candidates = candidates.filter(function (c) { return !c.classList.contains('char'); });
	// Add visible .char inside .hasInlineMenu > .children > .textnode
	let chars = Array.from(document.querySelectorAll('.hasInlineMenu > .children > .textnode .char'));
	chars = chars.filter(function (c) { return c.offsetParent !== null; });
	candidates = candidates.concat(chars);
	// Always add me to candidates if not present
	if (!candidates.includes(me)) candidates.push(me);

	// Find index of me in candidates
	const idx = candidates.indexOf(me);
	const next = candidates[idx - 1];
	if (next) {
		if (next.classList.contains("attributeName")) Xonomy.setFocus(next.closest(".attribute").id, "attributeName");
		else if (next.classList.contains("attributeValue")) Xonomy.setFocus(next.closest(".attribute").id, "attributeValue");
		else if (next.classList.contains("opening")) Xonomy.setFocus(next.closest(".element").id, "openingTagName");
		else if (next.classList.contains("closing")) Xonomy.setFocus(next.closest(".element").id, "closingTagName");
		else if (next.classList.contains("textnode")) Xonomy.setFocus(next.id, "text");
		else if (next.classList.contains("childrenCollapsed")) Xonomy.setFocus(next.closest(".element").id, "childrenCollapsed");
		else if (next.classList.contains("rollouter")) Xonomy.setFocus(next.closest(".element").id, "rollouter");
		else if (next.classList.contains("char")) Xonomy.setFocus(next.id, "char");
	}
};

Xonomy.handleElementClick = function (htmlID, what) {
	if (Xonomy.isElementReadOnly(htmlID)) return;
	Xonomy.setElementCurrent(htmlID);
	Xonomy.showElementMenuBubble(htmlID, what);
	Xonomy.triggerElementClickEvent(htmlID);
};

Xonomy.isElementReadOnly = function (htmlID) {
	const elem = document.getElementById(htmlID);
	return elem.classList.contains("readonly") || elem.closest('.readonly') !== null;
};

Xonomy.setElementCurrent = function (htmlID) {
	const elem = document.getElementById(htmlID);
	elem.classList.add("current");
};

Xonomy.showElementMenuBubble = function (htmlID, what) {
	const elem = document.getElementById(htmlID);
	var content = Xonomy.elementMenu(htmlID); //compose bubble content
	if (content != "" && content != "<div class='menu'></div>") {
		document.body.appendChild(Xonomy.makeBubble(content)); //create bubble
		if (what == "openingTagName") Xonomy.showBubble(elem.querySelector('> .tag.opening > .name'));
		if (what == "closingTagName") Xonomy.showBubble(elem.querySelector('> .tag.closing > .name'));
	}
};

Xonomy.triggerElementClickEvent = function (htmlID) {
	const elem = document.getElementById(htmlID);
	const surrogateElem = Xonomy.harvestElement(elem);
	// Trigger custom event
	var event = new CustomEvent('xonomy-click-element', { detail: surrogateElem });
	elem.dispatchEvent(event);
};

// Utility function for fade-in animation
Xonomy.fadeIn = function (element, duration, callback) {
	element.style.opacity = 0;
	element.style.display = '';
	let opacity = 0;
	let start = null;
	function fadeInStep(timestamp) {
		if (!start) start = timestamp;
		const elapsed = timestamp - start;
		opacity = Math.min(elapsed / duration, 1);
		element.style.opacity = opacity;
		if (elapsed < duration) {
			requestAnimationFrame(fadeInStep);
		} else {
			element.style.opacity = 1;
			if (typeof callback === 'function') callback();
		}
	}
	requestAnimationFrame(fadeInStep);
};

// Utility function for fade-out animation
Xonomy.fadeOut = function (element, duration, callback) {
	element.style.opacity = 1;
	let opacity = 1;
	let start = null;
	function fadeOutStep(timestamp) {
		if (!start) start = timestamp;
		const elapsed = timestamp - start;
		opacity = Math.max(1 - (elapsed / duration), 0);
		element.style.opacity = opacity;
		if (elapsed < duration) {
			requestAnimationFrame(fadeOutStep);
		} else {
			element.style.opacity = 0;
			if (typeof callback === 'function') callback();
		}
	}
	requestAnimationFrame(fadeOutStep);
};
