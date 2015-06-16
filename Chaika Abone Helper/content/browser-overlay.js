Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");

var cah_overlay = {

	init: function cahOverlay_init(){
		document.getElementById("contentAreaContextMenu")
			.addEventListener("popupshowing", cah_overlay.showContext, false);
	},

	uninit: function cahOverlay_uninit(){
		document.getElementById("contentAreaContextMenu")
			.removeEventListener("popupshowing", cah_overlay.showContext, false);
	},

	showContext: function cahOverlay_showContext(event){
		if(event.originalTarget.id != "contentAreaContextMenu") return;
		document.getElementById("cah-context-menu").hidden = true;

		var _document = gContextMenu.target.ownerDocument;
		var _window = _document.defaultView;

		if(!_window.getSelection().toString() ||
			!ChaikaCore.pref.getBool('abone.show_context') ||
			(ChaikaCore.pref.getBool('abone.show_context_only_2ch') && _document.URL.indexOf('127.0.0.1')==-1)
		) return;

		document.getElementById("cah-context-menu").hidden = false;
	},

	addAbone: function cahOverlay_addAbone(type){
		if(!gContextMenu) return;

		var _document = gContextMenu.target.ownerDocument;
		var _window = _document.defaultView;
		var selection = _window.getSelection();
		const count = selection.rangeCount;
		var data = {
			type: type,
			word: {
				title: '名称未設定',
				targetType: 'RES',
				conditions: []
			}
		};
		var range,aboneObj,typeNum;

		for(let i=0;i<count;i++){
			range = selection.getRangeAt(i);

			switch(type){
				case 'Name': if(typeNum==null) typeNum = 0;
				case 'Mail': if(typeNum==null) typeNum = 1;
				case 'ID':   if(typeNum==null) typeNum = 2;
				case 'Word': if(typeNum==null) typeNum = 3;
					if(data.word.conditions[0] == undefined){
						data.word.conditions[0] = range.toString();
					}else{
						data.word.conditions[0] += range.toString();
					}
					break;

				case 'ADV':
					aboneObj = {
						type: 'NAME',
						strType: 'STR',
						str: range.toString(),
						andor: 'AND',
						condStr: '!=='
					};
					data.word.conditions.push(aboneObj);
					break;
			}
		}

		if(!ChaikaCore.pref.getBool('abone.show_manager') && type != 'ADV'){
			if(!_window.confirm("\u6b21\u306e\u30ef\u30fc\u30c9\u3092\u3042\u307c\u30fc\u3093\u3057\u307e\u3059\u002e\u3088\u308d\u3057\u3044\u3067\u3059\u304b\u003f\n" + type + '\uff1a\u0020' + data.word.conditions[0])) return;
			ChaikaAboneManager.addAbone(data.word.conditions[0], typeNum);
		}else{
			_window.openDialog('chrome://chaika/content/settings/abone-manager.xul', '_blank', 'chrome, resizable, toolbar', data);
		}
	}
};

window.addEventListener('load', cah_overlay.init, false);
window.addEventListener('unload', cah_overlay.uninit, false);