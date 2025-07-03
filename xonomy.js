var Xonomy = {
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
	//Tells you whether an attribute name is a namespace declaration.
	var ret = false;
	if (attributeName == "xmlns") ret = true;
	if (attributeName.length >= 6 && attributeName.substring(0, 6) == "xmlns:") ret = true;
	return ret;
};
Xonomy.namespaces = {}; //eg. "xmlns:mbm": "http://lexonista.com"

Xonomy.xml2js = function (xml, jsParent) {
	if (typeof (xml) == "string") {
		xml = (new window.DOMParser()).parseFromString(xml, "application/xml");
	}
	if (xml.documentElement) xml = xml.documentElement;
	var js = new Xonomy.surrogate(jsParent);
	js.type = "element";
	js.name = xml.nodeName;
	js.htmlID = "";
	js.attributes = [];
	for (var i = 0; i < xml.attributes.length; i++) {
		var attr = xml.attributes[i];
		if (!Xonomy.isNamespaceDeclaration(attr.nodeName)) {
			if (attr.name != "xml:space") {
				js["attributes"].push({ type: "attribute", name: attr.nodeName, value: attr.value, htmlID: "", parent: function () { return js }, });
			}
		} else {
			Xonomy.namespaces[attr.nodeName] = attr.value;
		}
	}
	js.children = [];
	for (var i = 0; i < xml.childNodes.length; i++) {
		var child = xml.childNodes[i];
		if (child.nodeType == 1) { //element node
			js["children"].push(Xonomy.xml2js(child, js));
		}
		if (child.nodeType == 3) { //text node
			js["children"].push({ type: "text", value: child.nodeValue, htmlID: "", parent: function () { return js }, });
		}
	}
	js = Xonomy.enrichElement(js);
	return js;
};
Xonomy.js2xml = function (js) {
	if (js.type == "text") {
		return Xonomy.xmlEscape(js.value);
	} else if (js.type == "attribute") {
		return js.name + "='" + Xonomy.xmlEscape(js.value) + "'";
	} else if (js.type == "element") {
		var xml = "<" + js.name;
		for (var i = 0; i < js.attributes.length; i++) {
			var att = js.attributes[i];
			xml += " " + att.name + "='" + Xonomy.xmlEscape(att.value) + "'";
		}
		if (js.children.length > 0) {
			var hasText = false;
			for (var i = 0; i < js.children.length; i++) {
				var child = js.children[i];
				if (child.type == "text") hasText = true;
			}
			if (hasText) xml += " xml:space='preserve'";
			xml += ">";
			for (var i = 0; i < js.children.length; i++) {
				var child = js.children[i];
				if (child.type == "text") xml += Xonomy.xmlEscape(child.value); //text node
				else if (child.type == "element") xml += Xonomy.js2xml(child); //element node
			}
			xml += "</" + js.name + ">";
		} else {
			xml += "/>";
		}
		return xml;
	}
};
Xonomy.enrichElement = function (jsElement) {
	jsElement.hasAttribute = function (name) {
		var ret = false;
		for (var i = 0; i < this.attributes.length; i++) {
			if (this.attributes[i].name == name) ret = true;
		}
		return ret;
	};
	jsElement.getAttribute = function (name) {
		var ret = null;
		for (var i = 0; i < this.attributes.length; i++) {
			if (this.attributes[i].name == name) ret = this.attributes[i];
		}
		return ret;
	};
	jsElement.getAttributeValue = function (name, ifNull) {
		var ret = ifNull;
		for (var i = 0; i < this.attributes.length; i++) {
			if (this.attributes[i].name == name) ret = this.attributes[i].value;
		}
		return ret;
	};
	jsElement.hasChildElement = function (name) {
		var ret = false;
		for (var i = 0; i < this.children.length; i++) {
			if (this.children[i].name == name) ret = true;
		}
		return ret;
	};
	jsElement.getChildElements = function (name) {
		var ret = [];
		for (var i = 0; i < this.children.length; i++) {
			if (this.children[i].type == "element") {
				if (this.children[i].name == name) ret.push(this.children[i]);
			}
		}
		return ret;
	};
	jsElement.getDescendantElements = function (name) {
		var ret = [];
		for (var i = 0; i < this.children.length; i++) {
			if (this.children[i].type == "element") {
				if (this.children[i].name == name) ret.push(this.children[i]);
				var temp = this.children[i].getDescendantElements(name);
				for (var t = 0; t < temp.length; t++) ret.push(temp[t]);
			}
		}
		return ret;
	};
	jsElement.getText = function () {
		var txt = "";
		for (var i = 0; i < this.children.length; i++) {
			if (this.children[i].type == "text") txt += this.children[i].value;
			else if (this.children[i].type == "element") txt += this.children[i].getText();
		}
		return txt;
	};
	jsElement.hasElements = function () {
		for (var i = 0; i < this.children.length; i++) {
			if (this.children[i].type == "element") return true;
		}
		return false;
	};
	jsElement.getPrecedingSibling = function () {
		var parent = this.parent();
		if (parent) {
			var lastSibling = null;
			for (var i = 0; i < parent.children.length; i++) {
				if (parent.children[i].type == "element" && parent.children[i].htmlID != this.htmlID) {
					lastSibling = parent.children[i];
				} else if (parent.children[i].htmlID == this.htmlID) {
					return lastSibling;
				}
			}
		}
		return null;
	};
	jsElement.getFollowingSibling = function () {
		var parent = this.parent();
		if (parent) {
			var seenSelf = false;
			for (var i = 0; i < parent.children.length; i++) {
				if (parent.children[i].htmlID == this.htmlID) {
					seenSelf = true;
				} else if (parent.children[i].type == "element" && seenSelf) {
					return parent.children[i];
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
				name: name,
				value: value,
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
	var spec = Xonomy.docSpec.elements[name];
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
	for (var attributeName in spec.attributes) Xonomy.verifyDocSpecAttribute(name, attributeName);
	spec.askerParameter = Xonomy.asFunction(spec.askerParameter, null);
	spec.prominentChildren = Xonomy.asFunction(spec.prominentChildren, []);
};
Xonomy.verifyDocSpecAttribute = function (elementName, attributeName) { //make sure the DocSpec object has such an attribute, that the attribute has everything it needs
	var elSpec = Xonomy.docSpec.elements[elementName];
	if (!elSpec.attributes[attributeName] || typeof (elSpec.attributes[attributeName]) != "object") {
		if (Xonomy.docSpec.unknownAttribute) {
			elSpec.attributes[attributeName] = (typeof (Xonomy.docSpec.unknownAttribute) === "function")
				? Xonomy.docSpec.unknownAttribute(elementName, attributeName)
				: Xonomy.docSpec.unknownAttribute;
		}
		else elSpec.attributes[attributeName] = {};
	}
	var spec = elSpec.attributes[attributeName];
	if (!spec.asker || typeof (spec.asker) != "function") spec.asker = function () { return "" };
	spec.askerParameter = Xonomy.asFunction(spec.askerParameter, null);
	if (!spec.menu || typeof (spec.menu) != "object") spec.menu = [];
	spec.isReadOnly = Xonomy.asFunction(spec.isReadOnly, false);
	spec.isInvisible = Xonomy.asFunction(spec.isInvisible, false);
	spec.shy = Xonomy.asFunction(spec.shy, false);
	if (spec.displayName) spec.displayName = Xonomy.asFunction(spec.displayName, "");
	if (spec.title) spec.title = Xonomy.asFunction(spec.title, "");
	for (var i = 0; i < spec.menu.length; i++) Xonomy.verifyDocSpecMenuItem(spec.menu[i]);
};
Xonomy.verifyDocSpecMenuItem = function (menuItem) { //make sure the menu item has all it needs
	menuItem.caption = Xonomy.asFunction(menuItem.caption, "?");
	if (!menuItem.action || typeof (menuItem.action) != "function") menuItem.action = function () { };
	if (!menuItem.hideIf) menuItem.hideIf = function () { return false; };
	if (typeof (menuItem.expanded) != "function") menuItem.expanded = Xonomy.asFunction(menuItem.expanded, false);
};

Xonomy.nextID = function () {
	return "xonomy" + (++Xonomy.lastIDNum);
};
Xonomy.lastIDNum = 0;

Xonomy.docSpec = null;
Xonomy.refresh = function () {
	// Remove empty text nodes if the parent element is not allowed to have text
	document.querySelectorAll('.xonomy .textnode').forEach(function (el) {
		var parent = el.closest('.element');
		var parentName = parent ? parent.getAttribute('data-name') : null;
		var elSpec = parentName ? Xonomy.docSpec.elements[parentName] : null;
		if (elSpec && !elSpec.hasText(Xonomy.harvestElement(parent))) {
			if (el.getAttribute('data-value') === "") {
				el.remove();
			} else {
				var origText = el.getAttribute('data-value');
				var trimmedText = origText.trim();
				if (trimmedText !== origText) {
					var jsText = { type: "text", value: trimmedText };
					var html = Xonomy.renderText(jsText);
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
		var prev = el.previousElementSibling;
		if (!prev || !prev.classList.contains('textnode')) {
			el.insertAdjacentHTML('beforebegin', Xonomy.renderText({ type: "text", value: "" }));
		}
		var next = el.nextElementSibling;
		if (!next || !next.classList.contains('textnode')) {
			el.insertAdjacentHTML('afterend', Xonomy.renderText({ type: "text", value: "" }));
		}
	});
	// Merge adjacent text nodes
	var merged = false;
	while (!merged) {
		merged = true;
		var textnodes = Array.from(document.querySelectorAll('.xonomy .textnode'));
		for (var i = 0; i < textnodes.length; i++) {
			var thisNode = textnodes[i];
			var nextNode = thisNode.nextElementSibling;
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
		var atName = el.getAttribute('data-name');
		var elName = el.parentNode.parentNode.parentNode.getAttribute('data-name');
		var elSpec = Xonomy.docSpec.elements[elName];
		var mustBeAfter = [];
		for (var sibName in elSpec.attributes) {
			if (sibName === atName) break; else mustBeAfter.push(sibName);
		}
		var mustBeBefore = [], seen = false;
		for (var sibName in elSpec.attributes) {
			if (sibName === atName) seen = true; else if (seen) mustBeBefore.push(sibName);
		}
		if (mustBeBefore.length > 0) {
			var ok;
			do {
				ok = true;
				var prev = el.previousElementSibling;
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
				var next = el.nextElementSibling;
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
		var elSpec = Xonomy.docSpec.elements[el.getAttribute('data-name')];
		if (elSpec.displayName) el.querySelector('.tag .name').innerHTML = Xonomy.textByLang(elSpec.displayName(Xonomy.harvestElement(el)));
		if (elSpec.caption) {
			var jsEl = Xonomy.harvestElement(el);
			var inlinecaption = el.querySelector('.inlinecaption');
			if (inlinecaption) inlinecaption.innerHTML = Xonomy.textByLang(elSpec.caption(jsEl));
		}
		if (elSpec.displayValue) {
			var jsEl = Xonomy.harvestElement(el);
			if (!jsEl.hasElements()) {
				var children = el.querySelector('.children');
				if (children) children.innerHTML = Xonomy.textByLang(Xonomy.renderDisplayText(jsEl.getText(), elSpec.displayValue(jsEl)));
			}
		}
		el.querySelectorAll('.tag.opening > .attributes > .attribute').forEach(function (attrEl) {
			var atSpec = elSpec.attributes[attrEl.getAttribute('data-name')];
			if (atSpec.displayName) attrEl.querySelector('.name').innerHTML = Xonomy.textByLang(atSpec.displayName(Xonomy.harvestAttribute(attrEl)));
			if (atSpec.displayValue) attrEl.querySelector('.value').innerHTML = Xonomy.textByLang(atSpec.displayValue(Xonomy.harvestAttribute(attrEl)));
			if (atSpec.caption) attrEl.querySelector('.inlinecaption').innerHTML = "&nbsp;" + Xonomy.textByLang(atSpec.caption(Xonomy.harvestAttribute(attrEl))) + "&nbsp;";
		});
	});
};

Xonomy.harvestCache = {};
Xonomy.harvest = function () { //harvests the contents of an editor
	//Returns xml-as-string.
	// var rootElement = $(".xonomy .element").first().toArray()[0];
	var rootElement = document.querySelector('.xonomy .element');
	var js = Xonomy.harvestElement(rootElement);
	for (var key in Xonomy.namespaces) {
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
	var htmlID = htmlElement.id;
	if (!Xonomy.harvestCache[htmlID]) {
		var js = new Xonomy.surrogate(jsParent);
		js.type = "element";
		js.name = htmlElement.getAttribute("data-name");
		js.htmlID = htmlElement.id;
		js.attributes = [];
		// var htmlAttributes = $(htmlElement).find(".tag.opening > .attributes").toArray()[0];
		var htmlAttributes = htmlElement.querySelector('.tag.opening > .attributes');
		if (htmlAttributes) {
			for (var i = 0; i < htmlAttributes.childNodes.length; i++) {
				var htmlAttribute = htmlAttributes.childNodes[i];
				if (htmlAttribute.nodeType === 1 && htmlAttribute.classList.contains("attribute")) js["attributes"].push(Xonomy.harvestAttribute(htmlAttribute, js));
			}
		}
		js.children = [];
		// var htmlChildren = $(htmlElement).children(".prominentChildren").toArray()[0];
		var htmlProminentChildren = Array.prototype.find.call(htmlElement.children, function (child) { return child.classList && child.classList.contains('prominentChildren'); });
		if (htmlProminentChildren) {
			for (var i = 0; i < htmlProminentChildren.childNodes.length; i++) {
				var htmlChild = htmlProminentChildren.childNodes[i];
				if (htmlChild.nodeType === 1) js["children"].push(Xonomy.harvestElement(htmlChild, js));
			}
		}
		// var htmlChildren = $(htmlElement).children(".children").toArray()[0];
		var htmlChildren = Array.prototype.find.call(htmlElement.children, function (child) { return child.classList && child.classList.contains('children'); });
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
	var htmlID = htmlAttribute.id;
	if (!Xonomy.harvestCache[htmlID]) {
		var js = new Xonomy.surrogate(jsParent);
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
	var js = new Xonomy.surrogate(jsParent);
	js.type = "text";
	js.htmlID = htmlText.id;
	js.value = htmlText.getAttribute("data-value");
	return js;
}
Xonomy.harvestParentOf = function (js) {
	var jsParent = null;
	if (js.htmlID) {
		var elem = document.getElementById(js.htmlID);
		if (elem) {
			var parent = elem.parentElement;
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
	if (typeof (data) == "string") data = $.parseXML(data);
	if (data.documentElement) data = Xonomy.xml2js(data);

	//Make sure editor refers to an HTML element, if it doesn't already:
	if (typeof (editor) == "string") editor = document.getElementById(editor);
	// if (!$(editor).hasClass("xonomy")) $(editor).addClass("xonomy"); //make sure it has class "xonomy"
	if (!editor.classList.contains("xonomy")) editor.classList.add("xonomy");
	// $(editor).addClass(Xonomy.mode);
	if (!editor.classList.contains(Xonomy.mode)) editor.classList.add(Xonomy.mode);

	// $(editor).hide();
	editor.style.display = "none";
	editor.innerHTML = Xonomy.renderElement(data, editor);
	// $(editor).show();
	editor.style.display = "";

	if (docSpec.allowLayby) {
		var laybyHtml = "<div class='layby closed empty' onclick='if(this.classList.contains(\"closed\")) Xonomy.openLayby()' ondragover='Xonomy.dragOver(event)' ondragleave='Xonomy.dragOut(event)' ondrop='Xonomy.drop(event)''>";
		laybyHtml += "<span class='button closer' onclick='Xonomy.closeLayby();'>&nbsp;</span>";
		laybyHtml += "<span class='button purger' onclick='Xonomy.emptyLayby()'>&nbsp;</span>";
		laybyHtml += "<div class='content'></div>";
		laybyHtml += "<div class='message'>" + Xonomy.textByLang(docSpec.laybyMessage) + "</div>";
		laybyHtml += "</div>";
		// $(laybyHtml).appendTo($(editor));
		var tempDiv = document.createElement('div');
		tempDiv.innerHTML = laybyHtml;
		while (tempDiv.firstChild) {
			editor.appendChild(tempDiv.firstChild);
		}
	}

	if (docSpec.allowModeSwitching) {
		// $("<div class='modeSwitcher'><span class='nerd'></span><span class='laic'></span></div>").appendTo($(editor)).on("click", function (e) {
		//	if (Xonomy.mode == "nerd") { Xonomy.setMode("laic"); } else { Xonomy.setMode("nerd"); }
		//	if (docSpec.onModeSwitch) docSpec.onModeSwitch(Xonomy.mode);
		// });
		var modeSwitcher = document.createElement('div');
		modeSwitcher.className = 'modeSwitcher';
		var nerdSpan = document.createElement('span');
		nerdSpan.className = 'nerd';
		var laicSpan = document.createElement('span');
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
	// $(document.body).off("click", Xonomy.clickoff);
	// $(document.body).on("click", Xonomy.clickoff);
	document.body.removeEventListener("click", Xonomy.clickoff);
	document.body.addEventListener("click", Xonomy.clickoff);

	//Make sure the "drag end" handler is attached:
	// $(document.body).off("dragend", Xonomy.dragend);
	// $(document.body).on("dragend", Xonomy.dragend);
	document.body.removeEventListener("dragend", Xonomy.dragend);
	document.body.addEventListener("dragend", Xonomy.dragend);

	Xonomy.refresh();
	Xonomy.validate();
};
Xonomy.renderElement = function (element) {
	var htmlID = Xonomy.nextID();
	Xonomy.verifyDocSpecElement(element.name);
	var spec = Xonomy.docSpec.elements[element.name];
	var classNames = "element";
	if (spec.canDropTo && spec.canDropTo.length > 0) classNames += " draggable";
	var hasText = spec.hasText(element);
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
	var displayName = element.name;
	if (spec.displayName) displayName = Xonomy.textByLang(spec.displayName(element));
	var title = "";
	if (spec.title) title = Xonomy.textByLang(spec.title(element));
	var html = "";
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
		for (var i = 0; i < element.children.length; i++) {
			var child = element.children[i];
			if (child.type == "element") { //element node
				if (spec.prominentChildren && spec.prominentChildren(element).indexOf(child.name) > -1) html += Xonomy.renderElement(child);
			}
		}
		html += "</span>";
	}
	if (spec.caption && !spec.oneliner(element)) html += "<span class='inlinecaption'>" + Xonomy.textByLang(spec.caption(element)) + "</span>";
	html += '<span class="childrenCollapsed focusable" onclick="Xonomy.plusminus(\'' + htmlID + '\', true)">&middot;&middot;&middot;</span>';
	html += '<div class="children">';
	if (spec.displayValue && !element.hasElements()) {
		html += Xonomy.renderDisplayText(element.getText(), spec.displayValue(element));
	} else {
		var prevChildType = "";
		if (hasText && (element.children.length == 0 || element.children[0].type == "element")) {
			html += Xonomy.renderText({ type: "text", value: "" }); //if inline layout, insert empty text node between two elements
		}
		for (var i = 0; i < element.children.length; i++) {
			var child = element.children[i];
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
	html += '<span class="tag closing focusable" style="background-color: ' + spec.backgroundColour(element) + ';">';
	html += '<span class="punc">&lt;</span>';
	html += '<span class="punc">/</span>';
	html += '<span class="name" onclick="Xonomy.click(\'' + htmlID + '\', \'closingTagName\')">' + displayName + '</span>';
	html += '<span class="punc">&gt;</span>';
	html += '</span>';
	if (spec.oneliner(element)) {
		html += "<span class='prominentChildren'>";
		for (var i = 0; i < element.children.length; i++) {
			var child = element.children[i];
			if (child.type == "element") { //element node
				if (spec.prominentChildren && spec.prominentChildren(element).indexOf(child.name) > -1) html += Xonomy.renderElement(child);
			}
		}
		html += "</span>";
	}
	if (spec.caption && spec.oneliner(element)) html += "<span class='inlinecaption'>" + Xonomy.textByLang(spec.caption(element)) + "</span>";
	html += '</div>';
	element.htmlID = htmlID;
	return html;
};
Xonomy.renderAttribute = function (attribute, optionalParentName) {
	var htmlID = Xonomy.nextID();
	classNames = "attribute";
	var readonly = false;

	var displayName = attribute.name;
	var displayValue = Xonomy.xmlEscape(attribute.value);
	var caption = "";
	var title = "";
	if (optionalParentName) {
		var spec = Xonomy.docSpec.elements[optionalParentName].attributes[attribute.name];
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

	var html = "";
	html += '<span data-name="' + attribute.name + '" data-value="' + Xonomy.xmlEscape(attribute.value) + '" id="' + htmlID + '" class="' + classNames + '">';
	html += '<span class="punc"> </span>';
	var onclick = ''; if (!readonly) onclick = ' onclick="Xonomy.click(\'' + htmlID + '\', \'attributeName\')"';
	html += '<span class="warner"><span class="inside" onclick="Xonomy.click(\'' + htmlID + '\', \'warner\')"></span></span>';
	html += '<span class="name attributeName focusable" title="' + title + '"' + onclick + '>' + displayName + '</span>';
	html += '<span class="punc">=</span>';
	var onclick = ''; if (!readonly) onclick = ' onclick="Xonomy.click(\'' + htmlID + '\', \'attributeValue\')"';
	html += '<span class="valueContainer attributeValue focusable"' + onclick + '>';
	html += '<span class="punc">"</span>';
	html += '<span class="value">' + displayValue + '</span>';
	html += '<span class="punc">"</span>';
	html += '</span>';
	if (caption) html += "<span class='inlinecaption'>" + caption + "</span>";
	html += '</span>';
	attribute.htmlID = htmlID;
	return html;
};
Xonomy.renderText = function (text) {
	var htmlID = Xonomy.nextID();
	var classNames = "textnode focusable";
	if ($.trim(text.value) == "") classNames += " whitespace";
	if (text.value == "") classNames += " empty";
	var html = "";
	html += '<div id="' + htmlID + '" data-value="' + Xonomy.xmlEscape(text.value) + '" class="' + classNames + '">';
	html += '<span class="connector"></span>';
	var txt = Xonomy.chewText(text.value);
	html += '<span class="value" onclick="Xonomy.click(\'' + htmlID + '\', \'text\')"><span class="insertionPoint"><span class="inside"></span></span><span class="dots"></span>' + txt + '</span>';
	html += '</div>';
	text.htmlID = htmlID;
	return html;
}
Xonomy.renderDisplayText = function (text, displayText) {
	var htmlID = Xonomy.nextID();
	var classNames = "textnode";
	if ($.trim(displayText) == "") classNames += " whitespace";
	if (displayText == "") classNames += " empty";
	var html = "";
	html += '<div id="' + htmlID + '" data-value="' + Xonomy.xmlEscape(text) + '" class="' + classNames + '">';
	html += '<span class="connector"></span>';
	html += '<span class="value" onclick="Xonomy.click(\'' + htmlID + '\', \'text\')"><span class="insertionPoint"><span class="inside"></span></span><span class="dots"></span>' + Xonomy.textByLang(displayText) + '</span>';
	html += '</div>';
	text.htmlID = htmlID;
	return html;
}

Xonomy.chewText = function (txt) {
	var ret = "";
	ret += "<span class='word'>"; //start word
	for (var i = 0; i < txt.length; i++) {
		if (txt[i] == " ") ret += "</span>"; //end word
		var t = Xonomy.xmlEscape(txt[i])
		if (i == 0 && t == " ") t = "<span class='space'>&middot;</span>"; //leading space
		if (i == txt.length - 1 && t == " ") t = "<span class='space'>&middot;</span>"; //trailing space
		var id = Xonomy.nextID();
		ret += "<span id='" + id + "' class='char focusable' onclick='if((event.ctrlKey||event.metaKey) && $(this).closest(\".element\").hasClass(\"hasInlineMenu\")) Xonomy.charClick(this)'>" + t + "<span class='selector'><span class='inside' onclick='Xonomy.charClick(this.parentNode.parentNode)'></span></span></span>";
		if (txt[i] == " ") ret += "<span class='word'>"; //start word
	}
	ret += "</span>"; //end word
	return ret;
};
Xonomy.charClick = function (c) {
	Xonomy.clickoff();
	// Check if c or any ancestor has class 'readonly'
	var isReadOnly = false;
	var parent = c;
	while (parent) {
		if (parent.classList && parent.classList.contains('readonly')) {
			isReadOnly = true;
			break;
		}
		parent = parent.parentElement;
	}
	if (!isReadOnly) {
		Xonomy.notclick = true;
		var charsOn = document.querySelectorAll('.xonomy .char.on');
		if (
			charsOn.length == 1 &&
			charsOn[0].closest('.element') === c.closest('.element')
		) {
			var element = charsOn[0].closest('.element');
			var chars = Array.prototype.slice.call(element.querySelectorAll('.char'));
			var iFrom = chars.indexOf(charsOn[0]);
			var iTill = chars.indexOf(c);
			if (iFrom > iTill) { var temp = iFrom; iFrom = iTill; iTill = temp; }
			for (var i = 0; i < chars.length; i++) {
				if (i >= iFrom && i <= iTill) chars[i].classList.add('on');
			}
			// Save for later the info Xonomy needs to know what to wrap:
			var textFrom = chars[iFrom].closest('.textnode');
			var textTill = chars[iTill].closest('.textnode');
			Xonomy.textFromID = textFrom ? textFrom.id : null;
			Xonomy.textTillID = textTill ? textTill.id : null;
			var charsFromText = textFrom ? Array.prototype.slice.call(textFrom.querySelectorAll('.char')) : [];
			var charsTillText = textTill ? Array.prototype.slice.call(textTill.querySelectorAll('.char')) : [];
			Xonomy.textFromIndex = charsFromText.indexOf(chars[iFrom]);
			Xonomy.textTillIndex = charsTillText.indexOf(chars[iTill]);
			// Show inline menu etc:
			var htmlID = element.id;
			var content = Xonomy.inlineMenu(htmlID);
			if (content != "" && content != "<div class='menu'></div>") {
				document.body.appendChild(Xonomy.makeBubble(content));
				var charsOnList = element.querySelectorAll('.char.on');
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
	var xml = param.template;
	var ph = param.placeholder;
	var jsElement = Xonomy.harvestElement(document.getElementById(htmlID));
	if (Xonomy.textFromID == Xonomy.textTillID) { //abc --> a<XYZ>b</XYZ>c
		var jsOld = Xonomy.harvestText(document.getElementById(Xonomy.textFromID));
		var txtOpen = jsOld.value.substring(0, Xonomy.textFromIndex);
		var txtMiddle = jsOld.value.substring(Xonomy.textFromIndex, Xonomy.textTillIndex + 1);
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
		var jsOldOpen = Xonomy.harvestText(document.getElementById(Xonomy.textFromID));
		var jsOldClose = Xonomy.harvestText(document.getElementById(Xonomy.textTillID));
		var txtOpen = jsOldOpen.value.substring(0, Xonomy.textFromIndex);
		var txtMiddleOpen = jsOldOpen.value.substring(Xonomy.textFromIndex);
		var txtMiddleClose = jsOldClose.value.substring(0, Xonomy.textTillIndex + 1);
		var txtClose = jsOldClose.value.substring(Xonomy.textTillIndex + 1);
		xml = xml.replace(ph, Xonomy.xmlEscape(txtMiddleOpen) + ph);
		// Vanilla JS nextUntil implementation
		var startElem = document.getElementById(Xonomy.textFromID);
		var endElem = document.getElementById(Xonomy.textTillID);
		var current = startElem.nextElementSibling;
		var nodesToRemove = [];
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
	var elem = document.getElementById(htmlID);
	var parentID = elem.parentNode.parentNode.id;
	Xonomy.clickoff();
	var children = elem.querySelectorAll(':scope > .children > *');
	var fragment = document.createDocumentFragment();
	children.forEach(function (child) {
		fragment.appendChild(child);
	});
	elem.replaceWith(fragment);
	Xonomy.changed();
	window.setTimeout(function () { Xonomy.setFocus(parentID, "openingTagName"); }, 100);
};

Xonomy.plusminus = function (htmlID, forceExpand) {
	var element = document.getElementById(htmlID);
	var children = element.querySelector('.children');
	if (element.classList.contains("collapsed")) {
		if (children) children.style.display = 'none';
		element.classList.remove("collapsed");
		if (element.classList.contains("oneliner")) {
			if (children) {
				children.style.display = '';
			}
		} else {
			if (children) {
				children.style.display = '';
			}
		}
	} else if (!forceExpand) {
		Xonomy.updateCollapsoid(htmlID);
		if (element.classList.contains("oneliner")) {
			if (children) {
				children.style.display = 'none';
			}
			element.classList.add("collapsed");
		} else {
			if (children) {
				children.style.display = 'none';
			}
			element.classList.add("collapsed");
		}
	}
	window.setTimeout(function () {
		var currentElem = document.getElementById(Xonomy.currentHtmlId);
		if (currentElem && currentElem.querySelector('.opening')) {
			Xonomy.setFocus(Xonomy.currentHtmlId, "openingTagName");
		} else {
			Xonomy.setFocus(Xonomy.currentHtmlId, "childrenCollapsed");
		}
	}, 300);
};
Xonomy.updateCollapsoid = function (htmlID) {
	var $element = $("#" + htmlID);
	var whisper = "";
	var elementName = $element.data("name");
	var spec = Xonomy.docSpec.elements[elementName];
	if (spec.collapsoid) {
		whisper = spec.collapsoid(Xonomy.harvestElement($element.toArray()[0]));
	} else {
		var abbreviated = false;
		//		$element.find(".textnode").not(".prominentChildren *").each(function(){
		$element.find(".textnode").not($element.find("> .prominentChildren *")).each(function () {
			var txt = Xonomy.harvestText(this).value;
			for (var i = 0; i < txt.length; i++) {
				if (whisper.length < 35) whisper += txt[i]; else abbreviated = true;
			}
			whisper += " ";
		});
		whisper = whisper.replace(/  +/g, " ").replace(/ +$/g, "").replace(/^ +/g, "");
		if (abbreviated && !$element.hasClass("oneliner") && whisper != "...") whisper += "...";
	}
	if (whisper == "" || !whisper) whisper = "...";
	$element.children(".childrenCollapsed").html(whisper);
};

Xonomy.lastClickWhat = "";
Xonomy.click = function (htmlID, what) {
	if (!Xonomy.notclick) {
		Xonomy.clickoff();
		Xonomy.lastClickWhat = what;
		Xonomy.currentHtmlId = htmlID;
		Xonomy.currentFocus = what;
		// $(".xonomy .char.on").removeClass("on");
		var charOn = document.querySelectorAll('.xonomy .char.on');
		charOn.forEach(function (el) { el.classList.remove('on'); });
		var elem = document.getElementById(htmlID);
		var isReadOnly = elem.classList.contains("readonly") || elem.closest('.readonly') !== null;
		if (!isReadOnly && (what == "openingTagName" || what == "closingTagName")) {
			elem.classList.add("current"); //make the element current
			var content = Xonomy.elementMenu(htmlID); //compose bubble content
			if (content != "" && content != "<div class='menu'></div>") {
				document.body.appendChild(Xonomy.makeBubble(content)); //create bubble
				if (what == "openingTagName") Xonomy.showBubble(elem.querySelector('> .tag.opening > .name'));
				if (what == "closingTagName") Xonomy.showBubble(elem.querySelector('> .tag.closing > .name'));
			}
			var surrogateElem = Xonomy.harvestElement(elem);
			// Trigger custom event
			var event = new CustomEvent('xonomy-click-element', { detail: surrogateElem });
			elem.dispatchEvent(event);
		}
		if (!isReadOnly && what == "attributeName") {
			elem.classList.add("current"); //make the attribute current
			var content = Xonomy.attributeMenu(htmlID); //compose bubble content
			if (content != "" && content != "<div class='menu'></div>") {
				document.body.appendChild(Xonomy.makeBubble(content)); //create bubble
				Xonomy.showBubble(elem.querySelector('> .name'));
			}
			var surrogateAttr = Xonomy.harvestAttribute(elem);
			var event = new CustomEvent('xonomy-click-attribute', { detail: surrogateAttr });
			elem.dispatchEvent(event);
		}
		if (!isReadOnly && what == "attributeValue") {
			var valueContainer = elem.querySelector('> .valueContainer');
			if (valueContainer) valueContainer.classList.add("current"); //make attribute value current
			var name = elem.getAttribute("data-name"); //obtain attribute's name
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
					var html = Xonomy.renderAttribute({ type: "attribute", name: name, value: val }, elName);
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
					var jsText = { type: "text", value: val };
					var html = Xonomy.renderText(jsText);
					var prevHtmlId, prevWhat;
					var prevElem = elem.previousElementSibling;
					if (prevElem && prevElem.classList.contains('element')) {
						prevHtmlId = prevElem.id;
						prevWhat = "closingTagName";
					} else {
						var closestElem = elem.closest('.element');
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
			for (var iWarning = 0; iWarning < Xonomy.warnings.length; iWarning++) {
				var warning = Xonomy.warnings[iWarning];
				if (warning.htmlID == htmlID) {
					content += "<div class='warning'>" + Xonomy.formatCaption(Xonomy.textByLang(warning.text)) + "</div>";
				}
			}
			document.body.appendChild(Xonomy.makeBubble(content)); //create bubble
			var warnerInside = elem.querySelector('.warner .inside');
			if (warnerInside) Xonomy.showBubble(warnerInside); //anchor bubble to warner
		}
		if (what == "rollouter") {
			var tagOpening = elem.querySelector('.tag.opening');
			var attributes = tagOpening ? tagOpening.querySelector('.attributes') : null;
			var rollouter = tagOpening ? tagOpening.querySelector('.rollouter') : null;
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
		document.querySelectorAll('.xonomy .current').forEach(function(el) {
			el.classList.remove('current');
		});
		document.querySelectorAll('.xonomy .focused').forEach(function(el) {
			el.classList.remove('focused');
		});
		if (Xonomy.clearChars) {
			document.querySelectorAll('.xonomy .char.on').forEach(function(el) {
				el.classList.remove('on');
			});
			Xonomy.clearChars = false;
		}
	}
	Xonomy.notclick = false;
};

Xonomy.destroyBubble = function () {
	if (document.getElementById("xonomyBubble")) {
		var bubble = document.getElementById("xonomyBubble");
		$(bubble).find(":focus").blur();
		bubble.parentNode.removeChild(bubble);
		if (Xonomy.keyboardEventCatcher) Xonomy.keyboardEventCatcher.focus();
	}
};
Xonomy.makeBubble = function (content) {
	Xonomy.destroyBubble();
	var bubble = document.createElement("div");
	bubble.id = "xonomyBubble";
	bubble.className = Xonomy.mode;
	bubble.innerHTML = "<div class='inside' onclick='Xonomy.notclick=true;'>"
		+ "<div id='xonomyBubbleContent'>" + content + "</div>"
		+ "</div>";
	return bubble;
};
Xonomy.showBubble = function ($anchor) {
	var $bubble = $("#xonomyBubble");
	var offset = $anchor.offset();
	var screenWidth = $("body").width();
	var screenHeight = $(document).height();
	var bubbleHeight = $bubble.outerHeight();
	var width = $anchor.width(); if (width > 40) width = 40;
	var height = $anchor.height(); if (height > 25) height = 25;
	if (Xonomy.mode == "laic") { width = width - 25; height = height + 10; }

	function verticalPlacement() {
		var top = "";
		var bottom = "";
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

	var placement = verticalPlacement();
	if (offset.left < screenWidth / 2) {
		placement.left = (offset.left + width - 15) + "px";
	} else {
		$bubble.addClass("rightAnchored");
		placement.right = (screenWidth - offset.left) + "px";
	}
	$bubble.css(placement);
	$bubble.slideDown("fast", function () {
		if (Xonomy.keyNav) $bubble.find(".focusme").first().focus(); //if the context menu contains anything with the class name 'focusme', focus it.
		else $bubble.find("input.focusme, select.focusme, textarea.focusme").first().focus();
	});

	$bubble.on("keyup", function (event) {
		if (event.which == 27) Xonomy.destroyBubble();
	});

	if (Xonomy.keyNav) {
		$bubble.find("div.focusme").on("keyup", function (event) {
			if (event.which == 40) { //down key
				var $item = $(event.delegateTarget);
				var $items = $bubble.find(".focusme:visible");
				var $next = $items.eq($items.index($item[0]) + 1);
				$next.focus();
			}
			if (event.which == 38) { //up key
				var $item = $(event.delegateTarget);
				var $items = $bubble.find("div.focusme:visible");
				var $next = $items.eq($items.index($item[0]) - 1);
				$next.focus();
			}
			if (event.which == 13) { //enter key
				$(event.delegateTarget).click();
				Xonomy.notclick = false;
			}
		});
	}
};

Xonomy.askString = function (defaultString, askerParameter, jsMe) {
	const width = (document.body.clientWidth * 0.5) - 75;
	let html = "";
	html += "<form onsubmit='Xonomy.answer(this.val.value); return false'>";
	html += "<input name='val' class='textbox focusme' style='width: " + width + "px;' value='" + Xonomy.xmlEscape(defaultString) + "' onkeyup='Xonomy.notKeyUp=true'/>";
	html += " <input type='submit' value='OK'>";
	html += "</form>";
	return html;
};
Xonomy.askLongString = function (defaultString, askerParameter, jsMe) {
	const width = (document.body.clientWidth * 0.5) - 75;
	let html = "";
	html += "<form onsubmit='Xonomy.answer(this.val.value); return false'>";
	html += "<textarea name='val' class='textbox focusme' spellcheck='false' style='width: " + width + "px; height: 150px;'>" + Xonomy.xmlEscape(defaultString) + "</textarea>";
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
	html += "<input name='val' class='textbox focusme' value='" + (!isInPicklist ? Xonomy.xmlEscape(defaultString) : "") + "' onkeyup='Xonomy.notKeyUp=true'/>";
	html += " <input type='submit' value='OK'>";
	html += "</form>";
	return html;
};
Xonomy.askRemote = function (defaultString, param, jsMe) {
	let html = "";
	if (param.searchUrl || param.createUrl) {
		html += "<form class='overmenu' onsubmit='return Xonomy.remoteSearch(\"" + Xonomy.xmlEscape(param.searchUrl, true) + "\", \"" + Xonomy.xmlEscape(param.urlPlaceholder, true) + "\", \"" + Xonomy.xmlEscape(Xonomy.jsEscape(defaultString)) + "\")'>";
		html += "<input name='val' class='textbox focusme' value=''/>";
		if (param.searchUrl) html += " <button class='buttonSearch' onclick='return Xonomy.remoteSearch(\"" + Xonomy.xmlEscape(param.searchUrl, true) + "\", \"" + Xonomy.xmlEscape(param.urlPlaceholder, true) + "\", \"" + Xonomy.xmlEscape(Xonomy.jsEscape(defaultString)) + "\")'>&nbsp;</button>";
		if (param.createUrl) html += " <button class='buttonCreate' onclick='return Xonomy.remoteCreate(\"" + Xonomy.xmlEscape(param.createUrl, true) + "\", \"" + Xonomy.xmlEscape((param.searchUrl ? param.searchUrl : param.url), true) + "\", \"" + Xonomy.xmlEscape(param.urlPlaceholder, true) + "\", \"" + Xonomy.xmlEscape(Xonomy.jsEscape(defaultString)) + "\")'>&nbsp;</button>";
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
	const text = $("#xonomyBubble input.textbox").val();
	searchUrl = searchUrl.replace(urlPlaceholder, encodeURIComponent(text));
	$("#xonomyBubble .menu").replaceWith(Xonomy.wyc(searchUrl, function (picklist) {
		const items = [];
		if (text == "" && Xonomy.lastAskerParam.add) for (var i = 0; i < Xonomy.lastAskerParam.add.length; i++) items.push(Xonomy.lastAskerParam.add[i]);
		for (var i = 0; i < picklist.length; i++) items.push(picklist[i]);
		return Xonomy.pickerMenu(items, defaultString);
	}));
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
	for (let i = 0; i < picklist.length; i++) {
		var item = picklist[i];
		if (typeof (item) == "string") item = { value: item, caption: "" };
		html += "<div class='menuItem focusme techno" + (item.value == defaultString ? " current" : "") + "' tabindex='1' onclick='Xonomy.answer(\"" + Xonomy.xmlEscape(item.value) + "\")'>";
		var alone = true;
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
			$("#" + wycID).replaceWith(callback(Xonomy.wycCache[url]));
			if (Xonomy.wycQueue.length > 0) Xonomy.wycQueue[0](); else Xonomy.wycIsRunning = false; //run the next WYC job, or say that WYC has finished running
		} else {
			$.ajax({ url: url, dataType: "json", method: "POST" }).done(function (data) {
				$("#" + wycID).replaceWith(callback(data));
				if (Xonomy.wycCache.length > 1000) Xonomy.wycCache.length = [];
				Xonomy.wycCache[url] = data;
				if (Xonomy.wycQueue.length > 0) Xonomy.wycQueue[0](); else Xonomy.wycIsRunning = false; //run the next WYC job, or say that WYC has finished running
			});
		}
	});
	if (!Xonomy.wycIsRunning && Xonomy.wycQueue.length > 0) Xonomy.wycQueue[0]();
	return "<span class='wyc' id='" + wycID + "'></span>";
};

Xonomy.toggleSubmenu = function (menuItem) {
	// Helper to slide up (collapse)
	function slideUp(element, duration, callback) {
		element.style.height = element.offsetHeight + 'px';
		element.style.transitionProperty = 'height, margin, padding';
		element.style.transitionDuration = duration + 'ms';
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
		let height = element.offsetHeight;
		element.style.height = 0;
		element.style.paddingTop = 0;
		element.style.paddingBottom = 0;
		element.style.marginTop = 0;
		element.style.marginBottom = 0;
		element.offsetHeight; // force repaint
		element.style.transitionProperty = 'height, margin, padding';
		element.style.transitionDuration = duration + 'ms';
		element.style.overflow = 'hidden';
		element.style.height = height + 'px';
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
	var menuItemEl = menuItem;
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
	var fragments = items.map(function (item, i) {
		Xonomy.verifyDocSpecMenuItem(item);
		var jsMe = harvest(document.getElementById(htmlID));
		var includeIt = !item.hideIf(jsMe);
		var html = "";
		if (includeIt) {
			indices.push(i);
			var icon = ""; if (item.icon) icon = "<span class='icon'><img src='" + item.icon + "'/></span> ";
			var key = ""; if (item.keyTrigger && item.keyCaption) key = "<span class='keyCaption'>" + Xonomy.textByLang(item.keyCaption) + "</span>";
			if (item.menu) {
				var internalHtml = Xonomy.internalMenu(htmlID, item.menu, harvest, getter, indices);
				if (internalHtml != "<div class='submenu'></div>") {
					html += "<div class='menuItem" + (item.expanded(jsMe) ? " expanded" : "") + "'>";
					html += "<div class='menuLabel focusme' tabindex='0' onkeydown='if(Xonomy.keyNav && [37, 39].indexOf(event.which)>-1) Xonomy.toggleSubmenu(this.parentNode)' onclick='Xonomy.toggleSubmenu(this.parentNode)'>" + icon + Xonomy.formatCaption(Xonomy.textByLang(item.caption(jsMe))) + "</div>";
					html += internalHtml;
					html += "</div>";
				}
			} else {
				html += "<div class='menuItem focusme' tabindex='0' onclick='Xonomy.callMenuFunction(" + getter(indices) + ", \"" + htmlID + "\")'>";
				html += key + icon + Xonomy.formatCaption(Xonomy.textByLang(item.caption(jsMe)));
				html += "</div>";
			}
			indices.pop();
		}
		return html;
	});
	var cls = !indices.length ? 'menu' : 'submenu';
	return fragments.length
		? "<div class='" + cls + "'>" + fragments.join("") + "</div>"
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
	// Vanilla JS replacement for $("#" + htmlID).attr("data-name")
	const elem = document.getElementById(htmlID);
	const elName = elem ? elem.getAttribute("data-name") : null; //obtain element's name
	const spec = Xonomy.docSpec.elements[elName];
	function getter(indices) {
		return 'Xonomy.docSpec.elements["' + elName + '"].menu[' + indices.join('].menu[') + ']';
	}
	return Xonomy.internalMenu(htmlID, spec.menu, Xonomy.harvestElement, getter);
};
Xonomy.inlineMenu = function (htmlID) {
	Xonomy.harvestCache = {};
	// Use vanilla JS to get the element's name
	const elem = document.getElementById(htmlID);
	const elName = elem ? elem.getAttribute("data-name") : null; //obtain element's name
	const spec = Xonomy.docSpec.elements[elName];
	function getter(indices) {
		return 'Xonomy.docSpec.elements["' + elName + '"]' + '.inlineMenu[' + indices.join('].menu[') + ']';
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

	// Vanilla JS fadeOut
	let opacity = 1;
	const fadeDuration = 400; // ms, similar to jQuery default
	let start = null;
	function fadeOutStep(timestamp) {
		if (!start) start = timestamp;
		const elapsed = timestamp - start;
		opacity = Math.max(1 - (elapsed / fadeDuration), 0);
		obj.style.opacity = opacity;
		if (elapsed < fadeDuration) {
			requestAnimationFrame(fadeOutStep);
		} else {
			obj.style.opacity = 0;
			const parentNode = obj.parentNode;
			parentNode.removeChild(obj);
			Xonomy.changed();
			if (!parentNode.closest('.layby')) {
				window.setTimeout(function () { Xonomy.setFocus(parentID, "openingTagName"); }, 100);
			}
		}
	}
	requestAnimationFrame(fadeOutStep);
};
Xonomy.newAttribute = function (htmlID, parameter) {
	Xonomy.clickoff();
	var $element = $("#" + htmlID);
	var html = Xonomy.renderAttribute({ type: "attribute", name: parameter.name, value: parameter.value }, $element.data("name"));
	$("#" + htmlID + " > .tag.opening > .attributes").append(html);
	Xonomy.changed();
	//if the attribute we have just added is shy, force rollout:
	if ($("#" + htmlID + " > .tag.opening > .attributes").children("[data-name='" + parameter.name + "'].shy").toArray().length > 0) {
		if (!$("#" + htmlID).children(".tag.opening").children(".rollouter").hasClass("rolledout")) {
			$("#" + htmlID).children(".tag.opening").children(".rollouter").addClass("rolledout");
			$("#" + htmlID).children(".tag.opening").children(".attributes").addClass("rolledout").hide().slideDown("fast");
		}
	}
	if (parameter.value == "") Xonomy.click($(html).prop("id"), "attributeValue"); else Xonomy.setFocus($(html).prop("id"), "attributeValue");
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
	let opacity = 0;
	const fadeDuration = 400; // ms
	let start = null;
	function fadeInStep(timestamp) {
		if (!start) start = timestamp;
		const elapsed = timestamp - start;
		opacity = Math.min(elapsed / fadeDuration, 1);
		newElem.style.opacity = opacity;
		if (elapsed < fadeDuration) {
			requestAnimationFrame(fadeInStep);
		} else {
			newElem.style.opacity = 1;
		}
	}
	requestAnimationFrame(fadeInStep);

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
	var jsElement = Xonomy.harvestElement(document.getElementById(htmlID));
	var html = Xonomy.renderElement(Xonomy.xml2js(parameter, jsElement.parent()));
	var $html = $(html).hide();
	$("#" + htmlID).before($html);
	Xonomy.elementReorder($html.prop("id"));
	Xonomy.changed();
	$html.fadeIn();
	window.setTimeout(function () { Xonomy.setFocus($html.prop("id"), "openingTagName"); }, 100);
};
Xonomy.newElementAfter = function (htmlID, parameter) {
	Xonomy.clickoff();
	var jsElement = Xonomy.harvestElement(document.getElementById(htmlID));
	var html = Xonomy.renderElement(Xonomy.xml2js(parameter, jsElement.parent()));
	var $html = $(html).hide();
	$("#" + htmlID).after($html);
	Xonomy.elementReorder($html.prop("id"));
	Xonomy.changed();
	$html.fadeIn();
	window.setTimeout(function () { Xonomy.setFocus($html.prop("id"), "openingTagName"); }, 100);
};
Xonomy.replace = function (htmlID, jsNode) {
	var what = Xonomy.currentFocus;
	Xonomy.clickoff();
	var html = "";
	if (jsNode.type == "element") html = Xonomy.renderElement(jsNode);
	if (jsNode.type == "attribute") html = Xonomy.renderAttribute(jsNode);
	if (jsNode.type == "text") html = Xonomy.renderText(jsNode);
	$("#" + htmlID).replaceWith(html);
	Xonomy.changed();
	window.setTimeout(function () { Xonomy.setFocus($(html).prop("id"), what); }, 100);
};
Xonomy.editRaw = function (htmlID, parameter) {
	var div = document.getElementById(htmlID);
	var jsElement = Xonomy.harvestElement(div);
	if (parameter.fromJs) var txt = parameter.fromJs(jsElement);
	else if (parameter.fromXml) var txt = parameter.fromXml(Xonomy.js2xml(jsElement));
	else var txt = Xonomy.js2xml(jsElement);
	document.body.appendChild(Xonomy.makeBubble(Xonomy.askLongString(txt))); //create bubble
	Xonomy.showBubble($(div)); //anchor bubble to element
	Xonomy.answer = function (val) {
		var jsNewElement;
		if (parameter.toJs) jsNewElement = parameter.toJs(val, jsElement);
		else if (parameter.toXml) jsNewElement = Xonomy.xml2js(parameter.toXml(val, jsElement), jsElement.parent());
		else jsNewElement = Xonomy.xml2js(val, jsElement.parent());

		var obj = document.getElementById(htmlID);
		var html = Xonomy.renderElement(jsNewElement);
		$(obj).replaceWith(html);
		Xonomy.clickoff();
		Xonomy.changed();
		window.setTimeout(function () { Xonomy.setFocus($(html).prop("id"), "openingTagName"); }, 100);
	};
};
Xonomy.duplicateElement = function (htmlID) {
	Xonomy.clickoff();
	var html = document.getElementById(htmlID).outerHTML;
	var prefixID = Xonomy.nextID();
	html = html.replace(/ id=['"]/g, function (x) { return x + prefixID + "_" });
	html = html.replace(/Xonomy\.click\(['"]/g, function (x) { return x + prefixID + "_" });
	html = html.replace(/Xonomy\.plusminus\(['"]/g, function (x) { return x + prefixID + "_" });
	var $html = $(html).hide();
	$("#" + htmlID).after($html);
	Xonomy.changed();
	$html.fadeIn();
	window.setTimeout(function () { Xonomy.setFocus($html.prop("id"), "openingTagName"); }, 100);
};
Xonomy.moveElementUp = function (htmlID) {
	Xonomy.clickoff();
	var $me = $("#" + htmlID);
	if ($me.closest(".layby > .content").length == 0) {
		Xonomy.insertDropTargets(htmlID);
		var $droppers = $(".xonomy .elementDropper").add($me);
		var i = $droppers.index($me[0]) - 1;
		if (i >= 0) {
			$($droppers[i]).replaceWith($me);
			Xonomy.changed();
			$me.hide().fadeIn();
		}
		Xonomy.dragend();
	}
	window.setTimeout(function () { Xonomy.setFocus(htmlID, "openingTagName"); }, 100);
};
Xonomy.moveElementDown = function (htmlID) {
	Xonomy.clickoff();
	var $me = $("#" + htmlID);
	if ($me.closest(".layby > .content").length == 0) {
		Xonomy.insertDropTargets(htmlID);
		var $droppers = $(".xonomy .elementDropper").add($me);
		var i = $droppers.index($me[0]) + 1;
		if (i < $droppers.length) {
			$($droppers[i]).replaceWith($me);
			Xonomy.changed();
			$me.hide().fadeIn();
		}
		Xonomy.dragend();
	}
	window.setTimeout(function () { Xonomy.setFocus(htmlID, "openingTagName"); }, 100);
};
Xonomy.canMoveElementUp = function (htmlID) {
	var ret = false;
	var $me = $("#" + htmlID);
	if ($me.closest(".layby > .content").length == 0) {
		Xonomy.insertDropTargets(htmlID);
		var $droppers = $(".xonomy .elementDropper").add($me);
		var i = $droppers.index($me[0]) - 1;
		if (i >= 0) ret = true;
		Xonomy.dragend();
	}
	return ret;
};
Xonomy.canMoveElementDown = function (htmlID) {
	var ret = false;
	var $me = $("#" + htmlID);
	if ($me.closest(".layby > .content").length == 0) {
		Xonomy.insertDropTargets(htmlID);
		var $droppers = $(".xonomy .elementDropper").add($me);
		var i = $droppers.index($me[0]) + 1;
		if (i < $droppers.length) ret = true;
		Xonomy.dragend();
	}
	return ret;
};
Xonomy.mergeWithPrevious = function (htmlID, parameter) {
	var domDead = document.getElementById(htmlID);
	var elDead = Xonomy.harvestElement(domDead);
	var elLive = elDead.getPrecedingSibling();
	Xonomy.mergeElements(elDead, elLive);
};
Xonomy.mergeWithNext = function (htmlID, parameter) {
	var domDead = document.getElementById(htmlID);
	var elDead = Xonomy.harvestElement(domDead);
	var elLive = elDead.getFollowingSibling();
	Xonomy.mergeElements(elDead, elLive);
};
Xonomy.mergeElements = function (elDead, elLive) {
	Xonomy.clickoff();
	var domDead = document.getElementById(elDead.htmlID);
	if (elLive && elLive.type == "element") {
		for (var i = 0; i < elDead.attributes.length; i++) { //merge attributes
			var atDead = elDead.attributes[i];
			if (!elLive.hasAttribute(atDead.name) || elLive.getAttributeValue(atDead.name) == "") {
				elLive.setAttribute(atDead.name, atDead.value);
				if (elLive.hasAttribute(atDead.name)) $("#" + elLive.getAttribute(atDead.name).htmlID).remove();
				$("#" + elLive.htmlID).find(".attributes").first().append($("#" + elDead.attributes[i].htmlID));
			}
		}
		var specDead = Xonomy.docSpec.elements[elDead.name];
		var specLive = Xonomy.docSpec.elements[elLive.name];
		if (specDead.hasText(elDead) || specLive.hasText(elLive)) { //if either element is meant to have text, concatenate their children
			if (elLive.getText() != "" && elDead.getText() != "") {
				elLive.addText(" ");
				$("#" + elLive.htmlID).find(".children").first().append(Xonomy.renderText({ type: "text", value: " " }));
			}
			for (var i = 0; i < elDead.children.length; i++) {
				elLive.children.push(elDead.children[i]);
				$("#" + elLive.htmlID).find(".children").first().append($("#" + elDead.children[i].htmlID));
			}
		} else { //if no text, merge their children one by one
			for (var i = 0; i < elDead.children.length; i++) {
				var xmlDeadChild = Xonomy.js2xml(elDead.children[i]);
				var has = false;
				for (y = 0; y < elLive.children.length; y++) {
					var xmlLiveChild = Xonomy.js2xml(elLive.children[y]);
					if (xmlDeadChild == xmlLiveChild) { has = true; break; }
				}
				if (!has) {
					elLive.children.push(elDead.children[i]);
					$("#" + elLive.htmlID).find(".children").first().append($("#" + elDead.children[i].htmlID));
					Xonomy.elementReorder(elDead.children[i].htmlID);
				}
			}
		}
		domDead.parentNode.removeChild(domDead);
		Xonomy.changed();
		window.setTimeout(function () { Xonomy.setFocus(elLive.htmlID, "openingTagName"); }, 100);
	} else {
		window.setTimeout(function () { Xonomy.setFocus(htmlID, "openingTagName"); }, 100);
	}
};
Xonomy.deleteEponymousSiblings = function (htmlID, parameter) {
	var what = Xonomy.currentFocus;
	Xonomy.clickoff();
	var obj = document.getElementById(htmlID);
	var parent = obj.parentNode.parentNode;
	var _htmlChildren = $(parent).children(".children").toArray()[0].childNodes;
	var htmlChildren = []; for (var i = 0; i < _htmlChildren.length; i++) htmlChildren.push(_htmlChildren[i]);
	for (var i = 0; i < htmlChildren.length; i++) {
		var htmlChild = htmlChildren[i];
		if ($(htmlChild).hasClass("element")) {
			if ($(htmlChild).attr("data-name") == $(obj).attr("data-name") && htmlChild != obj) {
				htmlChild.parentNode.removeChild(htmlChild);
			}
		}
	}
	Xonomy.changed();
	window.setTimeout(function () { Xonomy.setFocus(htmlID, what); }, 100);
};

Xonomy.insertDropTargets = function (htmlID) {
	var $element = $("#" + htmlID);
	$element.addClass("dragging");
	var elementName = $element.attr("data-name");
	var elSpec = Xonomy.docSpec.elements[elementName];
	$(".xonomy .element:visible > .children").append("<div class='elementDropper' ondragover='Xonomy.dragOver(event)' ondragleave='Xonomy.dragOut(event)' ondrop='Xonomy.drop(event)'><div class='inside'></div></div>")
	$(".xonomy .element:visible > .children > .element").before("<div class='elementDropper' ondragover='Xonomy.dragOver(event)' ondragleave='Xonomy.dragOut(event)' ondrop='Xonomy.drop(event)'><div class='inside'></div></div>")
	$(".xonomy .element:visible > .children > .text").before("<div class='elementDropper' ondragover='Xonomy.dragOver(event)' ondragleave='Xonomy.dragOut(event)' ondrop='Xonomy.drop(event)'><div class='inside'></div></div>")
	$(".xonomy .dragging .children:visible > .elementDropper").remove(); //remove drop targets fom inside the element being dragged
	$(".xonomy .dragging").prev(".elementDropper").remove(); //remove drop targets from immediately before the element being dragged
	$(".xonomy .dragging").next(".elementDropper").remove(); //remove drop targets from immediately after the element being dragged
	$(".xonomy .children:visible > .element.readonly .elementDropper").remove(); //remove drop targets from inside read-only elements

	var harvestCache = {};
	var harvestElement = function (div) {
		var htmlID = $(div).prop("id");
		if (!harvestCache[htmlID]) harvestCache[htmlID] = Xonomy.harvestElement(div);
		return harvestCache[htmlID];
	};

	if (elSpec.localDropOnly(harvestElement($element.toArray()[0]))) {
		if (elSpec.canDropTo) { //remove the drop target from elements that are not the dragged element's parent
			var droppers = $(".xonomy .elementDropper").toArray();
			for (var i = 0; i < droppers.length; i++) {
				var dropper = droppers[i];
				if (dropper.parentNode != ev.target.parentNode.parentNode.parentNode) {
					dropper.parentNode.removeChild(dropper);
				}
			}
		}
	}
	if (elSpec.canDropTo) { //remove the drop target from elements it cannot be dropped into
		var droppers = $(".xonomy .elementDropper").toArray();
		for (var i = 0; i < droppers.length; i++) {
			var dropper = droppers[i];
			var parentElementName = $(dropper.parentNode.parentNode).toArray()[0].getAttribute("data-name");
			if ($.inArray(parentElementName, elSpec.canDropTo) < 0) {
				dropper.parentNode.removeChild(dropper);
			}
		}
	}
	if (elSpec.mustBeBefore) { //remove the drop target from after elements it cannot be after
		var jsElement = harvestElement($element.toArray()[0]);
		var droppers = $(".xonomy .elementDropper").toArray();
		for (var i = 0; i < droppers.length; i++) {
			var dropper = droppers[i];
			jsElement.internalParent = harvestElement(dropper.parentNode.parentNode); //pretend the element's parent is the dropper's parent
			var mustBeBefore = elSpec.mustBeBefore(jsElement);
			for (var ii = 0; ii < mustBeBefore.length; ii++) {
				if ($(dropper).prevAll("*[data-name='" + mustBeBefore[ii] + "']").toArray().length > 0) {
					dropper.parentNode.removeChild(dropper);
				}
			}
		}
	}
	if (elSpec.mustBeAfter) { //remove the drop target from before elements it cannot be before
		var jsElement = harvestElement($element.toArray()[0]);
		var droppers = $(".xonomy .elementDropper").toArray();
		for (var i = 0; i < droppers.length; i++) {
			var dropper = droppers[i];
			jsElement.internalParent = harvestElement(dropper.parentNode.parentNode); //pretend the element's parent is the dropper's parent
			var mustBeAfter = elSpec.mustBeAfter(jsElement);
			for (var ii = 0; ii < mustBeAfter.length; ii++) {
				if ($(dropper).nextAll("*[data-name='" + mustBeAfter[ii] + "']").toArray().length > 0) {
					dropper.parentNode.removeChild(dropper);
				}
			}
		}
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
	var htmlID = ev.target.parentNode.parentNode.id;
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
	if ($(ev.currentTarget).hasClass("layby")) {
		$(ev.currentTarget).addClass("activeDropper");
	} else {
		$(ev.target.parentNode).addClass("activeDropper");
	}
};
Xonomy.dragOut = function (ev) {
	ev.preventDefault();
	if ($(ev.currentTarget).hasClass("layby")) {
		$(ev.currentTarget).removeClass("activeDropper");
	} else {
		$(".xonomy .activeDropper").removeClass("activeDropper");
	}
};
Xonomy.drop = function (ev) {
	ev.preventDefault();
	var node = document.getElementById(Xonomy.draggingID); //the thing we are moving
	if ($(ev.currentTarget).hasClass("layby")) {
		$(node).hide();
		$(".xonomy .layby > .content").append(node);
		$(node).fadeIn(function () { Xonomy.changed(); });
	} else {
		$(node).hide();
		$(ev.target.parentNode).replaceWith(node);
		$(node).fadeIn(function () { Xonomy.changed(); });
	}
	Xonomy.openCloseLayby();
	Xonomy.recomputeLayby();
};
Xonomy.dragend = function (ev) {
	$(".xonomy .attributeDropper").remove();
	$(".xonomy .elementDropper").remove();
	$(".xonomy .dragging").removeClass("dragging");
	Xonomy.refresh();
	$(".xonomy .layby").removeClass("activeDropper");
};

Xonomy.openCloseLayby = function () { //open the layby if it's full, close it if it's empty
	if ($(".xonomy .layby > .content > *").length > 0) {
		$(".xonomy .layby").removeClass("closed").addClass("open");
	} else {
		$(".xonomy .layby").removeClass("open").addClass("closed");
	}
};
Xonomy.openLayby = function () {
	$(".xonomy .layby").removeClass("closed").addClass("open");
};
Xonomy.closeLayby = function () {
	window.setTimeout(function () {
		$(".xonomy .layby").removeClass("open").addClass("closed");
	}, 10);
};
Xonomy.emptyLayby = function () {
	$(".xonomy .layby .content").html("");
	$(".xonomy .layby").removeClass("nonempty").addClass("empty");
};
Xonomy.recomputeLayby = function () {
	if ($(".xonomy .layby > .content > *").length > 0) {
		$(".xonomy .layby").removeClass("empty").addClass("nonempty");
	} else {
		$(".xonomy .layby").removeClass("nonempty").addClass("empty");
	}
}
Xonomy.newElementLayby = function (xml) {
	Xonomy.clickoff();
	var html = Xonomy.renderElement(Xonomy.xml2js(xml));
	var $html = $(html).hide();
	$(".xonomy .layby > .content").append($html);
	Xonomy.refresh();
	$html.fadeIn();
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
	var js = Xonomy.harvestElement($(".xonomy .element").toArray()[0], null);
	$(".xonomy .invalid").removeClass("invalid");
	Xonomy.warnings = [];
	Xonomy.docSpec.validate(js); //validate the document
	for (var iWarning = 0; iWarning < Xonomy.warnings.length; iWarning++) {
		var warning = Xonomy.warnings[iWarning];
		$("#" + warning.htmlID).addClass("invalid");
	}
};
Xonomy.warnings = []; //array of {htmlID: "", text: ""}

Xonomy.textByLang = function (str) {
	//str = eg. "en: Delete | de: Löschen | fr: Supprimer"
	if (!str) str = "";
	var ret = str;
	var segs = str.split("|");
	for (var i = 0; i < segs.length; i++) {
		var seg = $.trim(segs[i]);
		if (seg.indexOf(Xonomy.lang + ":") == 0) {
			ret = seg.substring((Xonomy.lang + ":").length, ret.length);
		}
	}
	ret = $.trim(ret);
	return ret;
};

Xonomy.currentHtmlId = null;
Xonomy.currentFocus = null;
Xonomy.keyNav = false;
Xonomy.startKeyNav = function (keyboardEventCatcher, scrollableContainer) {
	Xonomy.keyNav = true;
	var $keyboardEventCatcher = $(keyboardEventCatcher); if (!keyboardEventCatcher) $keyboardEventCatcher = $(".xonomy");
	$scrollableContainer = $(scrollableContainer); if (!scrollableContainer) $scrollableContainer = $keyboardEventCatcher;
	$keyboardEventCatcher.attr("tabindex", "0");
	$keyboardEventCatcher.on("keydown", Xonomy.key);
	$(document).on("keydown", function (e) { if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1 && $("input:focus, select:focus, textarea:focus").length == 0) e.preventDefault(); }); //prevent default browser scrolling on arrow keys
	Xonomy.keyboardEventCatcher = $keyboardEventCatcher;
	Xonomy.scrollableContainer = $scrollableContainer;
};
Xonomy.setFocus = function (htmlID, what) {
	if (Xonomy.keyNav) {
		$(".xonomy .current").removeClass("current");
		$(".xonomy .focused").removeClass("focused");
		if (what == "attributeValue") $("#" + htmlID + " > .valueContainer").addClass("current").addClass("focused");
		else $("#" + htmlID).addClass("current").addClass("focused");
		Xonomy.currentHtmlId = htmlID;
		Xonomy.currentFocus = what;
		if (Xonomy.currentFocus == "openingTagName") $("#" + htmlID + " > .tag.opening").first().addClass("focused");
		if (Xonomy.currentFocus == "closingTagName") $("#" + htmlID + " > .tag.closing").last().addClass("focused");
		if (Xonomy.currentFocus == "childrenCollapsed") $("#" + htmlID + " > .childrenCollapsed").last().addClass("focused");
		if (Xonomy.currentFocus == "rollouter") $("#" + htmlID + " > .tag.opening > .rollouter").last().addClass("focused");
	}
};
Xonomy.key = function (event) {
	if (!Xonomy.notKeyUp) {
		if (!event.shiftKey && !$("#xonomyBubble").length > 0) {
			if (event.which == 27) { //escape key
				event.preventDefault();
				event.stopImmediatePropagation();
				Xonomy.destroyBubble();
			} else if (event.which == 13) { //enter key
				event.preventDefault();
				event.stopImmediatePropagation();
				if (Xonomy.currentFocus == "childrenCollapsed") Xonomy.plusminus(Xonomy.currentHtmlId, true);
				if (Xonomy.currentFocus == "char") {
					Xonomy.charClick($("#" + Xonomy.currentHtmlId)[0]);
				}
				else {
					Xonomy.click(Xonomy.currentHtmlId, Xonomy.currentFocus);
					Xonomy.clickoff();
				}
			} else if ((event.ctrlKey || event.metaKey) && event.which == 40) { //down key with Ctrl or Cmd (Mac OS)
				event.preventDefault();
				event.stopImmediatePropagation();
				Xonomy.scrollableContainer.scrollTop(Xonomy.scrollableContainer.scrollTop() + 60);
			} else if ((event.ctrlKey || event.metaKey) && event.which == 38) { //up key with Ctrl or Cmd (Mac OS)
				event.preventDefault();
				event.stopImmediatePropagation();
				Xonomy.scrollableContainer.scrollTop(Xonomy.scrollableContainer.scrollTop() - 60);
			} else if ((event.ctrlKey || event.metaKey) && [37, 39].indexOf(event.which) > -1) { //arrow keys with Ctrl or Cmd (Mac OS)
				event.preventDefault();
				event.stopImmediatePropagation();
				var $el = $("#" + Xonomy.currentHtmlId);
				if ($el.hasClass("element") && !$el.hasClass("uncollapsible")) {
					if (event.which == 39 && $el.hasClass("collapsed")) { //expand it!
						Xonomy.plusminus(Xonomy.currentHtmlId);
					}
					if (event.which == 37 && !$el.hasClass("collapsed")) { //collapse it!
						Xonomy.plusminus(Xonomy.currentHtmlId);
					}
				}
			} else if ([37, 38, 39, 40].indexOf(event.which) > -1 && !event.altKey) { //arrow keys
				event.preventDefault();
				event.stopImmediatePropagation();
				if (!Xonomy.currentHtmlId) { //nothing is current yet
					Xonomy.setFocus($(".xonomy .element").first().prop("id"), "openingTagName");
				} else if ($(".xonomy .focused").length == 0) { //something is current but nothing is focused yet
					Xonomy.setFocus(Xonomy.currentHtmlId, Xonomy.currentFocus);
				} else { //something is current, do arrow action
					if (event.which == 40) Xonomy.goDown(); //down key
					if (event.which == 38) Xonomy.goUp(); //up key
					if (event.which == 39) Xonomy.goRight(); //right key
					if (event.which == 37) Xonomy.goLeft(); //left key
				}
			}
		} else if (!$("#xonomyBubble").length > 0) {
			Xonomy.keyboardMenu(event);
		}
	}
	Xonomy.notKeyUp = false;
};
Xonomy.keyboardMenu = function (event) {
	Xonomy.harvestCache = {};
	var $obj = $("#" + Xonomy.currentHtmlId);
	var jsMe = null;
	var menu = null;
	if ($obj.hasClass("element")) {
		jsMe = Xonomy.harvestElement($obj[0]);
		var elName = $obj.attr("data-name");
		menu = Xonomy.docSpec.elements[elName].menu;
	} else if ($obj.hasClass("attribute")) {
		jsMe = Xonomy.harvestAttribute($obj[0]);
		var atName = $obj.attr("data-name");
		var elName = $obj.closest(".element").attr("data-name");
		menu = Xonomy.docSpec.elements[elName].attributes[atName].menu;
	}
	if (menu) {
		Xonomy.harvestCache = {};
		var findMenuItem = function (menu) {
			var ret = null;
			for (var i = 0; i < menu.length; i++) {
				if (menu[i].menu) ret = findMenuItem(menu[i].menu);
				else if (menu[i].keyTrigger && !menu[i].hideIf(jsMe) && menu[i].keyTrigger(event)) ret = menu[i];
				if (ret) break;
			}
			return ret;
		};
		var menuItem = findMenuItem(menu);
		if (menuItem) {
			Xonomy.callMenuFunction(menuItem, Xonomy.currentHtmlId);
			Xonomy.clickoff();
			return true;
		}
	}
	return false;
},

	Xonomy.goDown = function () {
		if (Xonomy.currentFocus != "openingTagName" && Xonomy.currentFocus != "closingTagName" && Xonomy.currentFocus != "text" && Xonomy.currentFocus != "char") {
			Xonomy.goRight();
		} else {
			var $el = $("#" + Xonomy.currentHtmlId);
			var $me = $el;
			if (Xonomy.currentFocus == "openingTagName") var $me = $el.find(".tag.opening").first();
			if (Xonomy.currentFocus == "closingTagName") var $me = $el.find(".tag.closing").last();

			var $candidates = $(".xonomy .focusable:visible").not(".attributeName").not(".attributeValue").not(".childrenCollapsed").not(".rollouter");
			$candidates = $candidates.not(".char").add($el);
			if (Xonomy.currentFocus == "openingTagName" && $el.hasClass("oneliner")) $candidates = $candidates.not("#" + Xonomy.currentHtmlId + " .tag.closing").not("#" + Xonomy.currentHtmlId + " .children *");
			if (Xonomy.currentFocus == "openingTagName" && $el.hasClass("oneliner")) $candidates = $candidates.not("#" + Xonomy.currentHtmlId + " .textnode");
			if (Xonomy.currentFocus == "openingTagName") $candidates = $candidates.not(".prominentChildren *");
			if ($el.hasClass("collapsed")) $candidates = $candidates.not("#" + Xonomy.currentHtmlId + " .tag.closing");
			if ($el.hasClass("textnode") && $el.closest(".prominentChildren").length == 0 && $(".xonomy").hasClass("nerd")) var $candidates = $el.closest(".element").find(".tag.closing:visible").last();
			if ($el.hasClass("textnode") && $(".xonomy").hasClass("laic")) var $candidates = $el.closest(".element").next().find(".focusable:visible").first();

			var $next = $candidates.eq($candidates.index($me[0]) + 1);
			if ($next.hasClass("opening")) Xonomy.setFocus($next.closest(".element").prop("id"), "openingTagName");
			else if ($next.hasClass("closing")) Xonomy.setFocus($next.closest(".element").prop("id"), "closingTagName");
			else if ($next.hasClass("textnode")) Xonomy.setFocus($next.prop("id"), "text");
		}
	};
Xonomy.goUp = function () {
	if (Xonomy.currentFocus != "openingTagName" && Xonomy.currentFocus != "closingTagName" && Xonomy.currentFocus != "char" && Xonomy.currentFocus != "text") {
		Xonomy.goLeft();
	} else {
		var $el = $("#" + Xonomy.currentHtmlId);
		var $me = $el;
		if (Xonomy.currentFocus == "openingTagName") var $me = $el.find(".tag.opening").first();
		if (Xonomy.currentFocus == "closingTagName") var $me = $el.find(".tag.closing").last();

		var $candidates = $(".xonomy .focusable:visible").not(".attributeName").not(".attributeValue").not(".childrenCollapsed").not(".rollouter");
		$candidates = $candidates.not(".element .oneliner .tag.closing");
		$candidates = $candidates.not(".element .oneliner .textnode");
		$candidates = $candidates.not(".element .collapsed .tag.closing");
		$candidates = $candidates.not(".char");
		if ($el.hasClass("char")) var $candidates = $el.closest(".textnode").first().add($el);
		if ($el.hasClass("textnode") && $el.closest(".prominentChildren").length > 0) $candidates = $candidates.add(".xonomy .prominentChildren .textnode");
		if ($el.hasClass("textnode") && $el.closest(".prominentChildren").length == 0) $candidates = $el.closest(".element").find(".tag.opening").first().add($el);
		if ($me.hasClass("closing") && $el.hasClass("hasText")) $candidates = $candidates.not("#" + Xonomy.currentHtmlId + " .children *:not(:first-child)");
		if ($me.hasClass("opening") && $el.closest(".element").prev().hasClass("hasText")) {
			var siblingID = $el.closest(".element").prev().prop("id");
			$candidates = $candidates.not("#" + siblingID + " .children *:not(:first-child)");
		}
		$candidates = $candidates.add($me);

		if ($candidates.index($me[0]) > 0) {
			var $next = $candidates.eq($candidates.index($me[0]) - 1);
			if ($next.hasClass("opening")) Xonomy.setFocus($next.closest(".element").prop("id"), "openingTagName");
			else if ($next.hasClass("closing")) Xonomy.setFocus($next.closest(".element").prop("id"), "closingTagName");
			else if ($next.hasClass("textnode")) Xonomy.setFocus($next.prop("id"), "text");
		}
	}
};
Xonomy.goRight = function () {
	var $el = $("#" + Xonomy.currentHtmlId);
	var $me = $el;
	if (Xonomy.currentFocus == "openingTagName") var $me = $el.find(".tag.opening").first();
	if (Xonomy.currentFocus == "closingTagName") var $me = $el.find(".tag.closing").last();
	if (Xonomy.currentFocus == "attributeName") var $me = $el.find(".attributeName").first();
	if (Xonomy.currentFocus == "attributeValue") var $me = $el.find(".attributeValue").first();
	if (Xonomy.currentFocus == "childrenCollapsed") var $me = $el.find(".childrenCollapsed").not(".prominentChildren *").first();
	if (Xonomy.currentFocus == "rollouter") var $me = $el.find(".rollouter").first();

	var $candidates = $(".xonomy .focusable:visible");
	$candidates = $candidates.not(".char").add(".hasInlineMenu > .children > .textnode .char:visible");

	var $next = $candidates.eq($candidates.index($me[0]) + 1);
	if ($next.hasClass("attributeName")) Xonomy.setFocus($next.closest(".attribute").prop("id"), "attributeName");
	if ($next.hasClass("attributeValue")) Xonomy.setFocus($next.closest(".attribute").prop("id"), "attributeValue");
	if ($next.hasClass("opening")) Xonomy.setFocus($next.closest(".element").prop("id"), "openingTagName");
	if ($next.hasClass("closing")) Xonomy.setFocus($next.closest(".element").prop("id"), "closingTagName");
	if ($next.hasClass("textnode")) Xonomy.setFocus($next.prop("id"), "text");
	if ($next.hasClass("childrenCollapsed")) Xonomy.setFocus($next.closest(".element").prop("id"), "childrenCollapsed");
	if ($next.hasClass("rollouter")) Xonomy.setFocus($next.closest(".element").prop("id"), "rollouter");
	if ($next.hasClass("char")) Xonomy.setFocus($next.prop("id"), "char");
};
Xonomy.goLeft = function () {
	var $el = $("#" + Xonomy.currentHtmlId);
	var $me = $el;
	if (Xonomy.currentFocus == "openingTagName") var $me = $el.find(".tag.opening").first();
	if (Xonomy.currentFocus == "closingTagName") var $me = $el.find(".tag.closing").last();
	if (Xonomy.currentFocus == "attributeName") var $me = $el.find(".attributeName").first();
	if (Xonomy.currentFocus == "attributeValue") var $me = $el.find(".attributeValue").first();
	if (Xonomy.currentFocus == "childrenCollapsed") var $me = $el.find(".childrenCollapsed").not(".prominentChildren *").first();
	if (Xonomy.currentFocus == "rollouter") var $me = $el.find(".rollouter").first();

	var $candidates = $(".xonomy .focusable:visible");
	$candidates = $candidates.not(".char").add(".hasInlineMenu > .children > .textnode .char:visible");
	$candidates = $candidates.add($me);

	var $next = $candidates.eq($candidates.index($me[0]) - 1);
	if ($next.hasClass("attributeName")) Xonomy.setFocus($next.closest(".attribute").prop("id"), "attributeName");
	if ($next.hasClass("attributeValue")) Xonomy.setFocus($next.closest(".attribute").prop("id"), "attributeValue");
	if ($next.hasClass("opening")) Xonomy.setFocus($next.closest(".element").prop("id"), "openingTagName");
	if ($next.hasClass("closing")) Xonomy.setFocus($next.closest(".element").prop("id"), "closingTagName");
	if ($next.hasClass("textnode")) Xonomy.setFocus($next.prop("id"), "text");
	if ($next.hasClass("childrenCollapsed")) Xonomy.setFocus($next.closest(".element").prop("id"), "childrenCollapsed");
	if ($next.hasClass("rollouter")) Xonomy.setFocus($next.closest(".element").prop("id"), "rollouter");
	if ($next.hasClass("char")) Xonomy.setFocus($next.prop("id"), "char");
};
