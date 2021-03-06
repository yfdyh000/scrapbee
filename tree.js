import {settings, log} from "./global.js"; 

/* class BookTree */
function translateResource(r, rdf_path, id){
    var r = r.replace(/^resource\:\/\/scrapbook/, settings.backend_url + "file-service/" + rdf_path.replace(/\\/g, '/') + "");
    return r.replace(/\/{2,}/g, '/');
}

function BookTree(xmlString, rdf_full_file){
    var self = this;
    this.rdf=rdf_full_file;
    this.rdf_path = rdf_full_file.replace(/[^\/\\]*$/, "");
    this.xmlDoc = new DOMParser().parseFromString(xmlString,'text/xml');
    var namespaces = this.getNameSpaces();
    Object.keys(namespaces).forEach(function(k){
	var v = namespaces[k];
	if(/^NS\d+$/.test(k))
	    self.MAIN_NS = v;
	self["NS_" + k] = v;
    });
}
BookTree.prototype.listenUserEvents=function(){
    var self=this;
    var draging=false;
    var $drag_item;
    var $ref_item;
    var t;
    function getItemNode(el){
	var $h = $(el);
	var $p = $h.parent();
	var $el;
	if($h.hasClass("item")){
	    $el = $h;
	}else if($p.hasClass("item")){
	    $el = $p;
	}
	return $el;
    }
    $(document.body).unbind('.BookTree');
    $(document.body).bind("mousedown.BookTree", function(e){
	var $el=getItemNode(e.target);
	if($el){
	    if(e.button==0){
		$drag_item = $el;
		$ref_item = $el;
		draging=true;
		t=0;
	    }
	    //this.setCapture(e);
            $(".item.focus").removeClass("focus");
            $el.addClass("focus");
	}
	var $f = $(".item.focus");
	if($f.hasClass("folder")) {
	    $(document.body).attr("contextmenu", "popup-menu-folder");
	}else if($f.hasClass("item")){
	    $(document.body).attr("contextmenu", "popup-menu-link");
	}else{
	    $(document.body).attr("contextmenu", "popup-menu-body");
	}
    });
    $(document.body).bind("click.BookTree", function(e){	
	var $el=getItemNode(e.target);
	if(!$el || !$el.length)
	    return;
	if($el.hasClass("folder")){
	    self.toggleFolder($el);
	}else if($el.hasClass("local") || $el.hasClass("bookmark")){
    	    if($el.attr("disabled"))
    		return;
	    var url = $el.attr("source");
	    if($el.hasClass("local") && !$(e.target).hasClass("origin")){
		url = self.getItemIndexPage($el.attr("id"));
	    }
	    if((settings.open_in_current_tab == "on") === !(e.ctrlKey || e.metaKey)){
		browser.tabs.update({url: url}, function(tab){});
	    }else{
		browser.tabs.create({url: url}, function(tab){});
	    }
	}
    });
    $(document).bind("mouseup.BookTree", function(e){			    
	if(!draging) return;
	draging=false;
	$(".drag-mark").remove();
	if($ref_item && [1,2,3].includes(t)){
	    if($drag_item[0] != $ref_item[0]){
		self.moveNode($drag_item, $ref_item, t);
	    }
	}
	$ref_item = null;
	$(".drag-into").removeClass("drag-into");
    });
    $(document).bind("mousemove.BookTree", function(e){			    
	if(!draging) return;
	// var $el = $ref_item = getItemNode(e.target) || $ref_item;
	var $el = $ref_item = self.getItemY(e.pageY) || $ref_item;
	var drag_mark = "<hr class='drag-mark'/>";
	if($el){
	    $(".drag-into").removeClass("drag-into");
	    var parentOffset = $el.offset(); 
	    var relX = e.pageX - parentOffset.left;
	    var relY = e.pageY - parentOffset.top;
	    /** get drag ref and position */
	    $ref_item=$el;
	    if($el.hasClass("folder")){
		var $children = $el.next(".folder-content").children(".item");
		var expanded_owner = $el.hasClass("expended") && ($children.length);
		var single_child = ($children.length==1 && self.getParentFolderItem($drag_item)[0]==$el[0]);
		if((!expanded_owner || single_child) && relY > $el.height() * 0.6){ // after
		    t=2;
		}else if(relY < $el.height() * 0.3){ // before
		    t=1;
		}else{
		    // self.toggleFolder($el, true);
		    t=3; // into
		}
	    }else{
		t = (relY > $el.height() * 0.5) ? 2 : 1;
	    }
	    /** show mark */
	    $(".drag-mark").remove();
	    if(t==1){
		$el.before(drag_mark)
	    }else if(t==2){
		$el.after(drag_mark)
	    }else if(t==3){
		if($el.hasClass("expanded")){
		    $el.next(".folder-content").prepend(drag_mark)
		}else if($drag_item[0]!=$el[0]){
		    $el.addClass("drag-into");
		}
	    }
	    /** ignore invalid folder dragging */
	    if($drag_item.hasClass("folder")){
		if($drag_item[0] == $el[0]){
		    t=0;
		}else if($.contains($drag_item.next(".folder-content")[0], $el[0])){
		    t=0;
		}
	    }
	}
    });
}
BookTree.prototype.getItemIndexPage=function(id){
    return (settings.backend_url + "file-service/" + this.rdf_path + "data/" + id + "/").replace(/\/{2,}/g, "/")
}
BookTree.prototype.toggleFolder=function($item, on){
    if($item && $item.hasClass("folder")){
        if(!$item.hasClass("expended") || on){
	    $item.addClass("expended");
	    $item.next(".folder-content").show();
        }else{
	    $item.removeClass("expended");
	    $item.next(".folder-content").hide();
        }
    }
}
BookTree.prototype.getItemY=function(y){
    y -= window.scrollY;
    var r=null;
    $(".item:visible").each(function(){
	var rect = this.getBoundingClientRect();
	if(rect.top < y && rect.bottom > y){
	    r=$(this);
	    return;
	}
    });
    return r;
}
BookTree.prototype.moveNode=function($item, $ref_item, move_type){
    if(![1,2,3].includes(move_type))
	return;
    var $c=$item.clone();
    if(move_type==3)
	$ref_item.next(".folder-content").prepend($c);
    else if(move_type==2)
	if($ref_item.hasClass("folder"))
	    $ref_item.next(".folder-content").after($c);
    else
        $ref_item.after($c);
    else if(move_type==1)
	$ref_item.before($c);
    if($item.hasClass("folder")){
	var $cc = $item.next(".folder-content").clone();
	$c.after($cc);
	$item.next(".folder-content").remove();
    }
    this.moveItemXml($c.attr("id"), $c.parent().prev(".folder").attr("id"), $ref_item.attr("id"), move_type);
    $item.remove();
}
BookTree.prototype.renderTree=function(){
    var self = this;
    var x = this.xmlDoc.getElementsByTagNameNS(this.NS_RDF, "Seq");
    var root_seq = this.getSeqNode("urn:scrapbook:root");
    var $root_container = $(".root.folder-content");
    $root_container.html("");
    try{
	this.iterateNodes(function(json){
	    var $container;
	    if(json.parentId){
		$container=$("#"+json.parentId+".folder").next(".folder-content");
	    }else{
		$container = $root_container;
	    }
	    switch(json.nodeType){
	    case "seq":
		self.createFolder($container, json.id, null, json.title);
		break;
	    case "item":
		self.createLink($container, json.type, json.id, null, json.source, json.icon, json.title);
		break;
	    case "separator":
		self.createSeparator($container, json.id, null);
		break;
	    }
	});
	this.rendered = true;
    }catch(e){
	log("error", e)
    }
    this.listenUserEvents();
}
BookTree.prototype.iterateNodes=function(fn){
    var self = this;
    var x = this.xmlDoc.getElementsByTagNameNS(this.NS_RDF, "Seq");
    var root_seq = this.getSeqNode("urn:scrapbook:root");
    function SeqProcesser(seq, parentId){
	var seq_id;
	var about = seq.getAttribute("RDF:about")
        if(about){
            var desc_node = self.getDescNode(about);
            if(desc_node){
		seq_id = desc_node.getAttributeNS(self.MAIN_NS, "id");
		fn({parentId: parentId,
		    nodeType:'seq',
		    id: seq_id,
		    title: desc_node.getAttributeNS(self.MAIN_NS, "title")});
            } else {
                // this is root
            }
        }
	for(var j=0; j<seq.children.length; j++){
	    try{	    
		var child =  seq.children[j];
		var seq_node = self.getSeqNode(child.getAttribute("RDF:resource"));
		var separator = self.getDecSeparator(child.getAttribute("RDF:resource"));
		if(seq_node){ // folder
                    SeqProcesser(seq_node, seq_id);
		}else if(separator){
		    var id = child.getAttribute("RDF:resource").replace("urn:scrapbook:item", "");
		    fn({nodeType:'separator', id: id, parentId: seq_id})
		}else{ // child
		    var node = self.getDescNode(child.getAttribute("RDF:resource"));
		    if(node){
			var type = node.getAttributeNS(self.MAIN_NS, "type");
			if(!(["local", "bookmark"].includes(type))) type = "local"
			fn({
			    parentId: seq_id,
			    nodeType:"item",
			    id: node.getAttributeNS(self.MAIN_NS, "id"),
			    type: type,
			    source: node.getAttributeNS(self.MAIN_NS, "source"),
			    icon: node.getAttributeNS(self.MAIN_NS, "icon"),
			    title: node.getAttributeNS(self.MAIN_NS, "title")
			});
		    }
		}
	    }catch(e){
		log("error", e.message)
	    }
        }
    }
    SeqProcesser(root_seq);
}
BookTree.prototype.updateItemIcon=function($item, icon){
    var id = $item.attr("id");
    $item.css("background-image", "url("+translateResource(icon, this.rdf_path, id)+")");
    var node = this.getDescNode("urn:scrapbook:item" + id);
    if(node) node.setAttributeNS(this.MAIN_NS, "icon", icon);
}
BookTree.prototype.renameItem=function($item, title, callback){
    var desc_node = this.getDescNode("urn:scrapbook:item"+$item.attr("id"));
    title = $.trim(title);
    if(desc_node){
	desc_node.setAttributeNS(this.MAIN_NS, "title", title);
	$item.find("label").html(title || "--untitled--");
	$item.attr("title", title);
	callback && callback();
    }
}
BookTree.prototype.getParentFolderItem=function($item){
    if(!$item.length)
	return null;
    return $item.parent(".folder-content").prev(".item.folder");
}
BookTree.prototype.getContainerFolderId=function($container){
    if(!$container.length)
	return "";
    return $container.prev(".item.folder").attr("id");
}
BookTree.prototype.createLink=function($container, type, id, ref_id, source, icon, title, wait, is_new_node){
    title = $.trim(title);
    if(!$container.length)
	$container = $(".folder.root");
    if(wait) icon = "icons/loading.gif";
    /** create item element */
    var $item = $("<div id='{id}' class='item {type}' title='{title}' source='{source}' draggable='true'><label>{label}</label></div>".fillData(
        {id:id, type: type, icon:icon, source: source,
         "title": title,
	 "label": title || "?"
	}));
    if(ref_id){
	$item.insertAfter($("#"+ref_id));
    }else{
	$item.appendTo($container);
    }
    /** show icon */
    if(icon){
        $item.css("background-image", "url(" + translateResource(icon, this.rdf_path, id) +")");
    }
    /** clicking-lock on waiting item */
    if(wait) $item.attr("disabled", "1");
    /** origin link */
    if(type == "local"){
        $("<div class='origin'></div>").appendTo($item);
    }
    /** add new node to doc */
    if(is_new_node){
	var folder_id = this.getContainerFolderId($container);
	this.createLinkXml(folder_id, type, id, ref_id, title, source, icon);
    }
}
BookTree.prototype.createFolder=function($container, id, ref_id, title, is_new_node){
    title = $.trim(title);
    var $folder = $("<div id='{id}' class='item folder' title='{title}' draggable='true'><label>{label}</label></div>".fillData({
	"id": id,
        "title": title,
	"label": title || "?"
    }));
    if(ref_id){
	$folder.insertAfter($("#"+ref_id));
    }else{
	$folder.appendTo($container);
    }
    var $content = $("<div class='folder-content'></div>").insertAfter($folder);;
    if(is_new_node){
	var folder_id = this.getContainerFolderId($container);
	this.createFolderXml(folder_id, id, ref_id, title);
    }
    return $content;    
}
BookTree.prototype.removeItem=function($item, callback){
    var self = this;
    var id = $item.attr("id");
    if($item.hasClass("folder")){
	$item.next(".folder-content").children(".item").each(function(){
	    self.removeItem($(this));
	});
	$item.next(".folder-content").remove();
    }
    $item.remove();
    if($item.hasClass("local") || $item.hasClass("bookmark")){
	this.onItemRemoved && this.onItemRemoved(id);
    }
    this.removeItemXml(id);
    callback && callback();
}
BookTree.prototype.createSeparator=function($container, id, ref_id, is_new_node){
    var $hr = $("<div class='item separator'/>");
    if(ref_id){
	$hr.insertAfter($("#" + ref_id)).attr("id", id);
    }else{
	$hr.appendTo($container).attr("id", id);
    }
    if(is_new_node){
	var folder_id = this.getContainerFolderId($container);
	this.createSeparatorXml(folder_id, id, ref_id);
    }
}
/** =============== xml part =============== */
BookTree.prototype.moveItemXml=function(id, folder_id, ref_id, move_type){
    var node = this.getLiNode("urn:scrapbook:item" + id);
    if(node){
	var nn = node.cloneNode();
	var seq_node = this.getSeqNode("urn:scrapbook:item" + folder_id) || this.getSeqNode("urn:scrapbook:root");
	var ref_node = this.getLiNode("urn:scrapbook:item" + ref_id);
	if(move_type==1){
	    seq_node.insertBefore(nn, ref_node);
	}else if(move_type==2){
	    seq_node.insertBefore(nn, ref_node.nextSibling);
	}else if(move_type==3){
	    seq_node.appendChild(nn);
	}
	node.parentNode.removeChild(node);
	this.onXmlChanged && this.onXmlChanged();
    }
}
BookTree.prototype.removeItemXml=function(id){
    var node = this.getLiNode("urn:scrapbook:item" + id);
    if(node)node.parentNode.removeChild(node);
    var node = this.getSeqNode("urn:scrapbook:item" + id);
    if(node)node.parentNode.removeChild(node);
    var node = this.getDescNode("urn:scrapbook:item" + id);
    if(node)node.parentNode.removeChild(node);
}
BookTree.prototype.createSeparatorXml=function(folder_id, id, ref_id){
    var seq_node = this.getSeqNode("urn:scrapbook:item" + folder_id) || this.getSeqNode("urn:scrapbook:root");
    if(seq_node){
	var node = this.xmlDoc.createElementNS(this.NS_RDF, "li");
	node.setAttributeNS(this.NS_RDF, "resource", "urn:scrapbook:item" + id);
	if(ref_id){
	    var ref_node = this.getLiNode("urn:scrapbook:item" + ref_id);
	    seq_node.insertBefore(node, ref_node.nextSibling);
	}else{
	    seq_node.appendChild(node);
	}
	var node = this.xmlDoc.createElementNS(this.NS_NC, "BookmarkSeparator");
	node.setAttributeNS(this.NS_RDF, "about", "urn:scrapbook:item" + id);
	node.setAttributeNS(this.MAIN_NS, "id", id);
	node.setAttributeNS(this.MAIN_NS, "type", "separator");
	this.xmlDoc.documentElement.appendChild(node);
	this.onXmlChanged && this.onXmlChanged();
    }
}
BookTree.prototype.createLinkXml=function(folder_id, type, id, ref_id, title, source, icon){
    var seq_node = this.getSeqNode("urn:scrapbook:item" + folder_id) || this.getSeqNode("urn:scrapbook:root");
    if(seq_node){
	var node = this.xmlDoc.createElementNS(this.NS_RDF, "li");
	node.setAttributeNS(this.NS_RDF, "resource", "urn:scrapbook:item" + id);
	if(ref_id){
	    var ref_node = this.getLiNode("urn:scrapbook:item" + ref_id);
	    seq_node.insertBefore(node, ref_node.nextSibling);
	}else{
	    seq_node.appendChild(node);
	}	
	var node = this.xmlDoc.createElementNS(this.NS_RDF, "Description");
	node.setAttributeNS(this.NS_RDF, "about", "urn:scrapbook:item" + id);
	node.setAttributeNS(this.MAIN_NS, "id", id);
	node.setAttributeNS(this.MAIN_NS, "type", type);
	node.setAttributeNS(this.MAIN_NS, "title", title);
	node.setAttributeNS(this.MAIN_NS, "chars", "UTF-8");
	node.setAttributeNS(this.MAIN_NS, "comment", "");
	node.setAttributeNS(this.MAIN_NS, "source", source);
	node.setAttributeNS(this.MAIN_NS, "icon", icon);
	this.xmlDoc.documentElement.appendChild(node);
    }
}
BookTree.prototype.createFolderXml=function(folder_id, id, ref_id, title){
    var seq_node = this.getSeqNode("urn:scrapbook:item" + folder_id) || this.getSeqNode("urn:scrapbook:root"); 
    if(seq_node){
	var node = this.xmlDoc.createElementNS(this.NS_RDF, "li");
	node.setAttributeNS(this.NS_RDF, "resource", "urn:scrapbook:item" + id);
	if(ref_id){
	    var ref_node = this.getLiNode("urn:scrapbook:item" + ref_id);
	    seq_node.insertBefore(node, ref_node.nextSibling);
	}else{
	    seq_node.appendChild(node);
	}
	var node = this.xmlDoc.createElementNS(this.NS_RDF, "Description");
	node.setAttributeNS(this.NS_RDF, "about", "urn:scrapbook:item" + id);
	node.setAttributeNS(this.MAIN_NS, "id", id);
	node.setAttributeNS(this.MAIN_NS, "type", "folder");
	node.setAttributeNS(this.MAIN_NS, "title", title);
	node.setAttributeNS(this.MAIN_NS, "chars", "UTF-8");
	node.setAttributeNS(this.MAIN_NS, "comment", "");
	this.xmlDoc.documentElement.appendChild(node);
	var node = this.xmlDoc.createElementNS(this.NS_RDF, "Seq");
	node.setAttributeNS(this.NS_RDF, "about", "urn:scrapbook:item" + id);
	this.xmlDoc.documentElement.appendChild(node);
    }
}
BookTree.prototype.xmlSerializ=function(){
    var serializer = new XMLSerializer();
    return serializer.serializeToString(this.xmlDoc);
}
BookTree.prototype.nsResolver=function() {
    var self = this;
    return function(prefix){
	return self["NS_" + prefix] || null;	
    }
}
BookTree.prototype.getLiNode=function(about){
    var search = '//RDF:li[@RDF:resource="'+ about +'"]';
    var result = this.xmlDoc.evaluate(search, this.xmlDoc, this.nsResolver(), XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    return result.iterateNext(); 
}
BookTree.prototype.getDescNode=function(about){
    var search = '//RDF:Description[@RDF:about="'+ about +'"]';
    var result = this.xmlDoc.evaluate(search, this.xmlDoc, this.nsResolver(), XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    return result.iterateNext(); 
}
BookTree.prototype.getSeqNode=function(about){
    var search = '//RDF:Seq[@RDF:about="'+about+'"]';
    var result = this.xmlDoc.evaluate(search, this.xmlDoc, this.nsResolver(), XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    return result.iterateNext(); 
}
BookTree.prototype.getDecSeparator=function(about){
    var search = '//NC:BookmarkSeparator[@RDF:about="'+about+'"]';
    var result = this.xmlDoc.evaluate(search, this.xmlDoc, this.nsResolver(), XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    return result.iterateNext(); 
}
BookTree.prototype.getNameSpaces=function(){
    var r = {};
    var k;
    for(k in this.xmlDoc.documentElement.attributes){
	var a = this.xmlDoc.documentElement.attributes[k];
	if(a.prefix == "xmlns")
            r[a.localName] = a.value;
    }
    return r;
}
export {BookTree};
