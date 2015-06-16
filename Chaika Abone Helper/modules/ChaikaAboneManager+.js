EXPORTED_SYMBOLS = ["ChaikaAboneManager2"];
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const fuelApp = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
const ADDON_ID = 'cah@software.2ch.net';


var ChaikaAboneManager2 = {

	_overlayed: false,

	/**
	 * ブラウザ起動時のプロファイル読み込み後に一度だけ実行され、初期化処理を行う。
	 * @private
	 */
	_startup: function ChaikaAboneManager2__startup(){
		//ChaikaCoreが初期化されていないときは初期化する
		if(!ChaikaCore.initialized){
			ChaikaCore._startup();
		}

		//chaikaのファイルが書き換えられているかどうかを調べる
		this._checkChaikaModified();

		//2回実行されないようにする
		if(!this._overlayed){
			this._overlayed = true;

			//chaika側の関数を書き換える
			this._replaceFunction();
			this._applyCSS();
		}

		//unicode converterの準備
		this.unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
					.createInstance(Ci.nsIScriptableUnicodeConverter);
		this.unicodeConverter.charset = 'Shift_JIS';

		//データの読み込み

		/**
		 * あぼーんデータ
		 * @type {Array|String(ShiftJIS)}
		 */
		this._aboneData = [];

		/**
		 * あぼーんオブジェクト
		 * @type {Array|aboneObject|UTF-8}
		 */
		this._aboneDataObj = [];

		/**
		 * あぼーんオブジェクトをJavaScriptコードにしたもの
		 * @type {Array|Function|UTF-8}
		 */
		this._aboneConditionData = [];

		this._aboneData["adv"] = ChaikaAboneManager._loadNgFile('NGadv.txt');

		this._aboneDataObj["adv"] = this._aboneData["adv"].map(function(item){
			return JSON.parse(this.unicodeConverter.ConvertToUnicode(item));
		}, this);

		this._aboneConditionData["adv"] = this._aboneDataObj["adv"].map(function(item){
			return this._getConditionFunc(item);
		}, this);

		//有効期限チェック
		//有効期限切れのものは削除する
		var now = Date.now();
		var shouldRemove = [];  //削除するべきもののインデックスが入る

		this._aboneDataObj["adv"].forEach(function(item, index){
			if(item.expire && item.expire < now)
				shouldRemove.push(index);
		});

		shouldRemove.reverse();

		shouldRemove.forEach(function(item){
			this.removeAbone(item);
		}, this);
	},

	/**
	 * ブラウザ終了時に一度だけ実行され、終了処理を行う。
	 * @private
	 */
	_quit: function ChaikaAboneManager2__quit(){
		ChaikaAboneManager._saveNgFile("NGadv.txt", this._aboneData["adv"]);
		this._branch.removeObserver('auto_skin_mod', this);
	},

	getVersion: function ChaikaAboneManager2_getVersion(){
         var extension = {
            name: 'Chaika Abone Helper', version: '0.0.1'
        };

        if(fuelApp.extensions){
            extension = fuelApp.extensions.get(ADDON_ID);
        }else{
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
            var temp_ext;

            AddonManager.getAddonByID(ADDON_ID, function(ext){
                temp_ext = ext;
            });

            var thread = Cc['@mozilla.org/thread-manager;1'].getService().mainThread;
            while (temp_ext === void(0)) {
                thread.processNextEvent(true);
            }

            extension = temp_ext;
        }

        return extension.version;
	},



	/**
	 * レス/スレがあぼーんされるべきかどうかを調べる
	 * @param {String} aName 名前
	 * @param {String} aMail メール
	 * @param {String} aID ID
	 * @param {String} aMsg レス本文
	 * @param {ChaikaThread} aThread スレッド
	 * @param {String} aBeID BeIDとランクを含めた文字列
	 * @param {Boolean} isThread 調べる対象がスレッドかどうか
	 * @param {String} aIP IPアドレス
	 * @param {String} aDate 書き込み日時
	 * @param {String} aHost ホスト
	 * @param {Number} aBeBaseID Be基礎番号
	 * @return {String/ShiftJIS|Boolean} マッチしたNGワードのタイトル ヒットしなかった場合には false が返る
	 */
	shouldAbone: function ChaikaAboneManager2_shouldAbone(aName, aMail, aID, aMsg, aThread, aBeID, isThread, aIP, aDate, aHost, aBeBaseID){
		var matchNGData;
		var now = Date.now();

		function checkFunc(ngData, aIndex, aArray){

			//期限切れのデータの時
			if(ngData.expire && ngData.expire < now) return false;

			//対象の種類(レス・スレ)が異なっているとき
			if( (!isThread && ngData.targetType === "THREAD") ||
				(isThread && ngData.targetType === "RES") )
				return false;

			var condFunc = ChaikaAboneManager2._aboneConditionData["adv"][aIndex];
			var result = condFunc(this.resData, this.resData_lower);

			if(result){
				//ページのエンコーディングがShift-JISなので、
				//中身がShift-JISなあぼーんオブジェクトを返す必要がある
				var aboneData = ChaikaAboneManager2._aboneDataObj["adv"][aIndex];
				matchNGData = {
					reason: ChaikaAboneManager2.unicodeConverter.ConvertFromUnicode(aboneData.title),
					hide: aboneData.hide,
					chain: aboneData.chain,
					autoNGID: aboneData.autoNGID,
				};
			}

			return result;
		}

		var resData = {
			name: this.unicodeConverter.ConvertToUnicode(aName),
			mail: this.unicodeConverter.ConvertToUnicode(aMail),
			id: aID,
			beid: aBeID,
			bebaseid: aBeBaseID ? aBeBaseID : '0',
			msg: this.unicodeConverter.ConvertToUnicode(aMsg),
			threadTitle: aThread.title,
			boardURL: aThread.boardURL.spec,
			threadURL: aThread.plainURL ? aThread.plainURL.spec : '',
			ip: aIP,
			date: this.unicodeConverter.ConvertToUnicode(aDate),
			host: aHost,
		};

		var resData_lower = {
			name: resData.name.toLowerCase(),
			mail: resData.mail.toLowerCase(),
			id: resData.id.toLowerCase(),
			beid: resData.beid.toLowerCase(),
			bebaseid: resData.bebaseid,
			msg: resData.msg.toLowerCase(),
			threadTitle: aThread.title.toLowerCase(),
			boardURL: aThread.boardURL.spec,
			threadURL: aThread.plainURL ? aThread.plainURL.spec : '',
			ip: aIP,
			date: resData.date,
			host: aHost
		};

		if(this._aboneDataObj["adv"].some(checkFunc, { resData: resData, resData_lower: resData_lower })) return matchNGData;
		return false;
	},

	/**
	 * あぼーんオブジェクトをJavaScriptのコードに変換する
	 * @param {aboneObject} ngData あぼーんオブジェクト
	 * @return {Function|Error} 変換後の関数オブジェクト 失敗時にはErrorオブジェクトが返る
	 */
	_getConditionFunc: function ChaikaAboneManager2__getConditionFunc(ngData){
		var code = '';

		for(let i=0,l=ngData.conditions.length; i<l; i++){
			let cond = ngData.conditions[i];

			code += '(';

				code += cond.ignoreCase ? 'resdata_lower.' : 'resdata.';

				switch(cond.type){
					case 'NAME': code += 'name'; break;
					case 'MAIL': code += 'mail'; break;
					case 'IP': code += 'ip'; break;
					case 'HOST': code += 'host'; break;
					case 'DATE': code += 'date'; break;
					case 'ID': code += 'id'; break;
					case 'BEID': code += 'beid'; break;
					case 'BEBASEID': code += 'bebaseid'; break;
					case 'RES': code += 'msg'; break;
					case 'THREAD': code += 'threadTitle'; break;
					case 'BOARD': code += 'boardURL'; break;
					case 'THREAD_URL': code += 'threadURL'; break;
				}

				let tmp = '';
				switch(cond.condStr){

					//含まない
					case '===':
						tmp =
							cond.strType === 'STR' ?
								'.indexOf("$$CONDITION$$") === -1'
							:
								'.search(/$$CONDITION$$/$$FLAG$$) === -1';
						break;

					//一致
					case 'ALL_EQUAL':
						tmp =
							cond.strType === 'STR' ?
								' === "$$CONDITION$$"'
							:
								'.search(/$$CONDITION$$/$$FLAG$$) !== -1';
						break;

					//不一致
					case 'NOT_EQUAL':
						tmp =
							cond.strType === 'STR' ?
								' !== "$$CONDITION$$"'
							:
								'.search(/$$CONDITION$$/$$FLAG$$) === -1';
						break;

					//含む
					case '!==':
					default:
						tmp =
							cond.strType === 'STR' ?
								'.indexOf("$$CONDITION$$") !== -1'
							:
								'.search(/$$CONDITION$$/$$FLAG$$) !== -1';
						break;
				}

				code += tmp.replace('$$CONDITION$$', cond.str).replace('$$FLAG$$', cond.ignoreCase ? 'i' : '');

			code += ')';

			//最後以外の時は間に && か || を入れる
			if( (i+1) < ngData.conditions.length ){
				if(cond.andor == 'AND') code += ' && ';
				else if(cond.andor == 'OR') code += ' || ';
			}
		}

		try{
			return new Function("resdata", "resdata_lower", "return " + code);
		}catch(ex){
			ChaikaCore.logger.error(ex);
			return ex;
		}
	},

	/**
	 * NGワードを追加する
	 * 追加されたNGワードはJSON化されたものが b2r-abone-data-add を通じて通知される
	 * @param {JSON} あぼーんオブジェクトをJSON化した文字列
	 * @return {Error} JavaScriptコードに変換した時エラーが発生するとそのエラーオブジェクトが返る
	 */
	addAbone: function ChaikaAboneManager2_addAbone(aWord){
		var sjisWord = this.unicodeConverter.ConvertFromUnicode(aWord);
		var aboneObj = JSON.parse(aWord);
		var condFunc = this._getConditionFunc(aboneObj);

		//不正な値の時
		if(typeof condFunc !== 'function'){
			return condFunc;
		}

		//重複チェック
		if(this._aboneData["adv"].indexOf(sjisWord) !== -1){
			return new Error('Same NG data already exists.');
		}

		this._aboneData["adv"].push(sjisWord);
		this._aboneDataObj["adv"].push(aboneObj);
		this._aboneConditionData["adv"].push(condFunc);

		//chaikaに通知する
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		var type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
		type.data = 99;

		os.notifyObservers(type, "b2r-abone-data-add", aWord);
	},

	/**
	 * NGワードを削除する
	 * 削除されたあぼーんオブジェクトをJSON化したものが　b2r-abone-data-removeを通じて通知される
	 * @param {Number} aIndex 削除するNGワードの _aboneData["adv"] でのインデックス番号
	 */
	removeAbone: function ChaikaAboneManager2_removeAbone(aIndex){
		//通知用に保存しておく
		var removedWord = this.unicodeConverter.ConvertToUnicode(this._aboneData["adv"][aIndex]);

		//削除
		this._aboneData["adv"].splice(aIndex, 1);
		this._aboneDataObj["adv"].splice(aIndex, 1);
		this._aboneConditionData["adv"].splice(aIndex, 1);

		//chaikaに通知する
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		var type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
		type.data = 99;
		os.notifyObservers(type, "b2r-abone-data-remove", removedWord);
	},

	/**
	 * NGワードを編集する
	 * 編集後のNGワードが b2r-abone-data-add を通じて通知される
	 * @param {Number} aIndex 編集するNGワードの _aboneData["adv"] でのインデックス番号
	 * @param {JSON} 編集後のあぼーんオブジェクト
	 */
	editAbone: function ChaikaAboneManager2_editAbone(aIndex, aWord){
		if(aIndex == null) return;

		var sjisWord = this.unicodeConverter.ConvertFromUnicode(aWord);
		var aboneObj = JSON.parse(aWord);
		var condFunc = this._getConditionFunc(aboneObj);

		//エラーの時
		if(typeof condFunc !== 'function'){
			return condFunc;
		}

		//重複チェック
		if(this._aboneData["adv"].indexOf(sjisWord) !== -1){
			return new Error('Same NG data is already exists.');
		}

		this._aboneData["adv"][aIndex] = sjisWord;
		this._aboneDataObj["adv"][aIndex] = aboneObj;
		this._aboneConditionData["adv"][aIndex] = condFunc;

		//chaikaに通知する
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		var type = Cc["@mozilla.org/supports-PRInt32;1"].createInstance(Ci.nsISupportsPRInt32);
		type.data = 99;

		os.notifyObservers(type, "b2r-abone-data-add", aWord);
	},

	/**
	 * replaceでchaikaの関数を書き換える
	 */
	_replaceFunction: function ChaikaAboneManager2__replaceFunction(){

		Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");

		//ChaikaAboneManager.js もあぼーん元のワードを返すようにする
		var func = ''+
			'function ChaikaAboneManager_shouldAbone(aName, aMail, aID, aMsg){\
				var matchNGData;\
\
				function checkFunc(aElement, aIndex, aArray){\
					if(this.indexOf(aElement) !== -1){\
						matchNGData = { reason: aElement };\
						return true;\
					}\
					return false;\
				}\
\
				if(this._aboneData["name"].some(checkFunc, aName)) return matchNGData;\
				if(this._aboneData["mail"].some(checkFunc, aMail)) return matchNGData;\
				if(this._aboneData["id"].some(checkFunc, aID)) return matchNGData;\
				if(this._aboneData["word"].some(checkFunc, aMsg)) return matchNGData;\
\
				return false;\
			}';

		eval('ChaikaAboneManager.shouldAbone = ' + func);

	},

	/**
	 * cssを適用する
	 */
	_applyCSS: function ChaikaAboneManager2__applyCSS(){
		var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
		var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

		//page.xulを-moz-bindingでoverlayするためのCSS
		var page_overlay = ios.newURI("chrome://cah/content/page-overlay.css", null, null);
		sss.loadAndRegisterSheet(page_overlay, sss.USER_SHEET);

		//あぼーんされた理由をスキンで表示するためのCSS
		if(ChaikaCore.pref.getBool('abone.auto_skin_mod')){
			var skin_overlay = ios.newURI("chrome://cah/content/skin-overlay.css", null, null);
			sss.loadAndRegisterSheet(skin_overlay, sss.USER_SHEET);
		}

		//extensions.chaika.abone.auto_skin_mod を監視して動的にskin-overlay.cssを
		//読み込んだり解除したりするためのobserverを登録する
		var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
		this._branch = prefs.getBranch('extensions.chaika.abone.');
		this._branch.QueryInterface(Ci.nsIPrefBranch2);
		this._branch.addObserver('auto_skin_mod', this, false);
	},

	/**
	 * abone.auto_skin_mod の変更に応じて動的に skin-overlay.css を登録/解除するためのオブザーバ
	 */
	observe: function ChaikaAboneManager2_observe(aSubject, aTopic, aData){
		if(aTopic !== 'nsPref:changed') return;

		var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
		var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var skin_overlay = ios.newURI("chrome://cah/content/skin-overlay.css", null, null);

		if(ChaikaCore.pref.getBool('abone.auto_skin_mod')){
			sss.loadAndRegisterSheet(skin_overlay, sss.USER_SHEET);
		}else{
			if(sss.sheetRegistered(skin_overlay, sss.USER_SHEET))
				sss.unregisterSheet(skin_overlay, sss.USER_SHEET);
		}

	},

	/**
	 * thread.js が変更されているかどうかを調べる
	 * 変更されていない場合には自動で変更する
	 */
	_checkChaikaModified: function ChaikaAboneManager2__checkChaikaModified(){
		const CHAIKA_ID = "chaika@chaika.xrea.jp";

		//thread.jsの読み込み
		var file = Cc["@mozilla.org/file/directory_service;1"]
					.getService(Ci.nsIProperties)
					.get("ProfD", Ci.nsILocalFile);
		file.setRelativeDescriptor(file, 'extensions/' + CHAIKA_ID + '/modules/server/thread.js');

		var data = ChaikaCore.io.readData(file);


		//先頭2500文字以内に追記したことを示すコメントがない場合は
		//変更されていないとみなし自動変更するかどうか尋ねる
		var version = this.getVersion();
		if(data.lastIndexOf('/* *** Automatically modified by Chaika Abone Helper ' + version, 2500) === -1){

			var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
			var result = prompts.confirm(null, "Chaika Abone Helper Setup",
							decodeURIComponent(escape(
							    'thread.js が ver' + version + ' 用に変更されていないようです.\n' +
								'未変更の場合 Chaika Abone Helper は正しく動作しません.\n' +
								'自動で変更しますか？\n\n' +
								'(オリジナルはthread.js.orgとして保存されます.\n' +
								'また, 起動後に Chaika Abone Helper が正しく動作していない場合には Firefox を再起動して下さい.)'
							))
						);

			if(result){
				//オリジナルを保存
				var original = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
				original.setRelativeDescriptor(file, '../thread.js.org');

				if(!original.exists()){
					original.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0644);
					ChaikaCore.io.writeData(original, data);
				}else{
					data = ChaikaCore.io.readData(original);
				}


				//修正
				data =

				//追記したことを明記
				data.replace(' * ***** END LICENSE BLOCK ***** */',
				    ' * ***** END LICENSE BLOCK ***** */\n\n' +
				    '/* *** Automatically modified by Chaika Abone Helper ' + version + ' [' + (new Date()).toString() + '] *** */')

				//ChaikaAboneManager+.jsの読み込み
				.replace('Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");',

					'Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");\n' +
					'try{\n' +
					'    Components.utils.import("resource://cah/ChaikaAboneManager+.js");\n' +
					'}catch(e){\n' +
					'    ChaikaCore.logger.warning("It seems that Chaika Abone Helper is not installed.");\n' +
					'}')


				//Thread2ch#_initの修正
				.replace('this._chainAboneNumbers = new Array();',

					'this._chainAboneNumbers = new Array();\n\
					this._chainHideAboneNumbers = new Array();')


				//Thread2ch#datLineParseの修正
				//変数宣言
				.replace('var isAbone = false;',

					'var isAbone = false;\n\
					var resIP = "";\n\
					var resHost = "";\n\
					var resBeBaseID = "";\n\
					var aboneResult = {};    //あぼーん結果オブジェクト\n\
					var aboneWord = "";      //あぼーん元NGワード\n\
					var chainParentNum = 0;  //連鎖あぼーんの大元のレス番号', 'g')

				//ID等の解析部
				//r333相当の修正(ID末尾に空白がつくバグを修正)
				.replace('(.+)ID:(.+)', '(.+)ID:([^ ]+)')

				.replace('if(resBeID){',

			        '// resDate を DATE と 発信元 に分割（resIPはどのスキンも対応してないはずなのでとりあえず発信元は日付のところに残しておく）\n\
					// \\x94\\xad \\x90\\x4d \\x8c\\xb3 = 発信元\n\
					if(resDate.indexOf("\\x94\\xad\\x90\\x4d\\x8c\\xb3") != -1 && resDate.match(/(.+)\\x94\\xad\\x90\\x4d\\x8c\\xb3:([\\d\\.]+)/)){\n\
						//resDate = RegExp.$1;\n\
						resIP = RegExp.$2;\n\
					}\n\
\n\
					// resDate を DATE と HOST に分割（resHostはどのスキンも対応してないはずなのでとりあえずHOSTは日付のところに残しておく）\n\
					if(resDate.indexOf("HOST:") != -1 && resDate.match(/(.+)HOST:([^ ]+)/)){\n\
						//resDate = RegExp.$1;\n\
						resHost = RegExp.$2;\n\
					}\n\
\n\
					// Be基礎番号を取得\n\
					// refs http://qb5.2ch.net/test/read.cgi/operate/1296265910/569\n\
					if(resBeID){\n\
						var benum = Number(resBeID.match(/^(\\d+)/)[0]);\n\
						resBeBaseID = ( Math.floor(benum/100) + ( Math.floor(benum/10) % 10 ) - (benum % 10) - 5 ) /\n\
											( (Math.floor(benum/10) % 10) * (benum % 10) * 3 );\n\
						resBeBaseID = String(resBeBaseID);\n\
					}\n\
\n\
					if(resBeID){')

				//あぼーん判定
				//もとの処理はコメントアウトする
				.replace('ChaikaAboneManager.shouldAbone(resName, resMail, resID, resMes)){',

					'(typeof ChaikaAboneManager2 !== "undefined" ?\n\
						(\n\
							aboneResult =\n\
								ChaikaAboneManager2.shouldAbone(resName, resMail, resID, resMes, this.thread,\n\
					   											resBeID, false, resIP, resDate, resHost, resBeBaseID) ||\n\
								ChaikaAboneManager.shouldAbone(resName, resMail, resID, resMes)\n\
						) :\n\
						(\n\
							ChaikaAboneManager.shouldAbone(resName, resMail, resID, resMes)\n\
						)\n\
					)){\n\
\n\
						//あぼーんフラグを立てる\n\
						isAbone = true;\n\
\n\
						//あぼーん元のNGワードを記録する\n\
						aboneWord = aboneResult.reason || "";\n\
\n\
						//連鎖あぼーん用に記録\n\
						if(typeof aboneResult.chain === "boolean" ? aboneResult.chain : this._enableChainAbone){\n\
							this._chainAboneNumbers.push(aNumber);\n\
						}\n\
\n\
						//自動NGID\n\
						if(aboneResult.autoNGID && resID && resID !== "???"){\n\
							//翌日の0:00に設定する\n\
							var now = new Date();\n\
							var expire = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);\n\
\n\
							var aboneObj = {\n\
								title: "Auto NGID: " + resID,\n\
								targetType: "RES",\n\
								expire: expire.getTime(),\n\
								autoNGID: false,\n\
								conditions: [{\n\
									type: "ID",\n\
									strType: "STR",\n\
									str: resID,\n\
									andor: "AND",\n\
									condStr: "ALL_EQUAL",\n\
									ignoreCase: false\n\
								}]\n\
							};\n\
\n\
							ChaikaAboneManager2.addAbone(JSON.stringify(aboneObj));\n\
						}\n\
\n\
						//透明あぼーん\n\
						if(typeof aboneResult.hide === "boolean" ? aboneResult.hide : aNumber>1 && ChaikaCore.pref.getBool("thread_hide_abone")){\n\
							this._chainHideAboneNumbers.push(aNumber);\n\
							return "";\n\
						}\n\
					}/*', 'g')

				.replace('// JSでは "\\" が特殊な意味を持つため、数値文字参照に変換',

				    '*/ // JSでは "\\" が特殊な意味を持つため、数値文字参照に変換', 'g')

				//連鎖あぼーん判定部
				.replace('var chainAboneNumbers = this._chainAboneNumbers;',

				    'var chainAboneNumbers = this._chainAboneNumbers;\n\
				    var chainHideAboneNumbers = this._chainHideAboneNumbers;\n\
					var shouldChainHideAbone = false;', 'g')

				//r344以前
				.replace('var chainAbone = false;', 'var shouldChainAbone = false;', 'g')

				//r344以前
				.replace('chainAbone = chainAbone || (chainAboneNumbers.indexOf(parseInt(aP2)) != -1);',

					'var index = chainAboneNumbers.indexOf(parseInt(aP2));\n\
					if(!shouldChainAbone && index !== -1){\n\
						shouldChainAbone = true;\n\
						shouldChainHideAbone = shouldChainHideAbone || chainHideAboneNumbers.indexOf(parseInt(aP2)) !== -1;\n\
						chainParentNum = chainAboneNumbers[index];\n\
					}', 'g')

				//r344以前
				.replace('if(this._enableChainAbone && chainAbone){', 'if(shouldChainAbone){', 'g')

				//r345以降
				.replace('var enableChainAbone = this._enableChainAbone;', '')

				//r345以降
				.replace(/([^_])enableChainAbone/g, '$1chainAboneNumbers.length > 0')

				//r345以降
				.replace('return chainAboneNumbers.indexOf(ancNum) !== -1;',

					'var index = chainAboneNumbers.indexOf(ancNum);\n\
					if(index !== -1){\n\
						shouldChainHideAbone = shouldChainHideAbone || chainHideAboneNumbers.indexOf(ancNum) !== -1;\n\
						chainParentNum = chainAboneNumbers[index];\n\
						return true;\n\
					}\n\
					return false;', 'g')

				//連鎖あぼーん処理部
				//もとの処理はコメントアウトにする
				.replace('if(shouldChainAbone){',

					'if(shouldChainAbone){\n\
						this._chainAboneNumbers.push(aNumber);\n\
						isAbone = true;\n\
						aboneWord = "[Chain Abone] >>" + chainParentNum;\n\
\n\
						//連鎖透明あぼーん\n\
						//親が透明あぼーんの時に発動\n\
						if(shouldChainHideAbone){\n\
							this._chainHideAboneNumbers.push(aNumber);\n\
							return "";\n\
						}\n\
					}/*', 'g')

				.replace('if(resMes.indexOf("ttp")!=-1){', '*/ if(resMes.indexOf("ttp")!=-1){', 'g')

				//toFunctionへと処理を渡す部分
				.replace('resMailName, resDate, resID, resBeID, resMes, isAbone);',

					'resMailName, resDate, resID, resBeID, resMes, isAbone, aboneWord);', 'g')


				//b2rThreadConverter#getResponseの修正
				.replace('getResponse: function(aNew, aNumber, aName, aMail, aMailName, aDate, aID, aBeID, aMessage, aIsAbone){',

				    'getResponse: function(aNew, aNumber, aName, aMail, aMailName, aDate, aID, aBeID, aMessage, aIsAbone, aAboneWord){')

				.replace(/resIDColor,\s*resIDBgColor,\s*aBeID,\s*aMessage\);/,

					'resIDColor, resIDBgColor, aBeID, aMessage, aAboneWord);')


				//b2rThreadConverter#toFunctionの修正
				//r328相当の変更(コード統一のため)
				.replace('return eval(', '')

				.replace('"function(aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor, aBeID, aMessage){return \\""+aRes',

				    'return new Function("aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor, aBeID, aMessage",\n\
						"return \\"" + aRes')

				.replace('.replace(/<MESSAGE\\/>/g, "\\"+aMessage+\\"")+"\\";}"',

		        	'.replace(/<MESSAGE\\/>/g, "\\"+aMessage+\\"") + "\\"");')

				//<ABONEWORD/>の処理の追加
				//元の処理をコメントアウト
				.replace('.replace(/<MESSAGE\\/>/g, "\\"+aMessage+\\"") + "\\"");',

					'.replace(/<MESSAGE\\/>/g, "\\"+aMessage+\\"") + "\\""); */')

				.replace('return new Function("aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor, aBeID, aMessage",',

					'return new Function("aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor, aBeID, aMessage, aAboneWord",\n\
						"if(aAboneWord && ChaikaCore.pref.getBool(\'abone.show_reason_on_thread\')) return \\"" +\n\
							( ChaikaCore.pref.getBool(\'abone.auto_skin_mod\') ?\n\
								aRes\n\
									.replace(/class\\=[\'"]?(resHeader|rh|header|resNewHeader)[\'"]?>/g, "class=\'$1\' aboneWord=\'<ABONEWORD/>\'>")\n\
									.replace(\'<dd ondblclick="javascript:ChgFontstyle(event);">\',\n\
											"<dd ondblclick=\'javascript:ChgFontstyle(event);\' aboneWord=\'<ABONEWORD/>\'>")\n\
									.replace(\'<h2 class="ng">\', \'<h2 class="ng" aboneWord="<ABONEWORD/>">\')\n\
								:\n\
								aRes\n\
							)\n\
							.replace(/\\\\/g,"\\\\\\\\").replace(/\\"/g,"\\\\\\"")\n\
							.replace(/(\\r|\\n|\\t)/g,"").replace(/<!--.*?-->/g,"")\n\
							.replace(/<PLAINNUMBER\\/>/g, "\\"+aNumber+\\"")\n\
							.replace(/<ABONEWORD\\/>/g, "\\"+aAboneWord+\\"")\n\
							.replace(/<NUMBER\\/>/g, "\\"+aNumber+\\"")\n\
							.replace(/<NAME\\/>/g, "\\"+aName+\\"")\n\
							.replace(/<MAIL\\/>/g, "\\"+aMail+\\"")\n\
							.replace(/<MAILNAME\\/>/g, "\\"+aMailName+\\"")\n\
							.replace(/<DATE\\/>/g, "\\"+aDate+\\"")\n\
							.replace(/<ID\\/>/g, "\\"+aID+\\"")\n\
							.replace(/<IDCOLOR\\/>/g, "\\"+resIDColor+\\"")\n\
							.replace(/<IDBACKGROUNDCOLOR\\/>/g, "\\"+resIDBgColor+\\"")\n\
							.replace(/<BEID\\/>/g, "\\"+aBeID+\\"")\n\
							.replace(/<MESSAGE\\/>/g, "\\"+aMessage+\\"") +\n\
						"\\"; else return \\"" + aRes\n\
							.replace(/\\\\/g,"\\\\\\\\").replace(/\\"/g,"\\\\\\"")\n\
							.replace(/(\\r|\\n|\\t)/g,"").replace(/<!--.*?-->/g,"")\n\
							.replace(/<PLAINNUMBER\\/>/g, "\\"+aNumber+\\"")\n\
							.replace(/<NUMBER\\/>/g, "\\"+aNumber+\\"")\n\
							.replace(/<NAME\\/>/g, "\\"+aName+\\"")\n\
							.replace(/<MAIL\\/>/g, "\\"+aMail+\\"")\n\
							.replace(/<MAILNAME\\/>/g, "\\"+aMailName+\\"")\n\
							.replace(/<DATE\\/>/g, "\\"+aDate+\\"")\n\
							.replace(/<ID\\/>/g, "\\"+aID+\\"")\n\
							.replace(/<IDCOLOR\\/>/g, "\\"+resIDColor+\\"")\n\
							.replace(/<IDBACKGROUNDCOLOR\\/>/g, "\\"+resIDBgColor+\\"")\n\
							.replace(/<BEID\\/>/g, "\\"+aBeID+\\"")\n\
							.replace(/<MESSAGE\\/>/g, "\\"+aMessage+\\"") + "\\""); /*')

				//r491以降
				.replace('return function(aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor, aBeID, aMessage){',
				         'return function(aNumber, aName, aMail, aMailName, aDate, aID, resIDColor, resIDBgColor, aBeID, aMessage, aAboneWord){')

				.replace('return aRes',

					'var _res = aRes;\n\
					if(aAboneWord && ChaikaCore.pref.getBool(\'abone.auto_skin_mod\')){\n\
						_res = _res\n\
							.replace(/class\\=[\'"]?(resHeader|rh|header|resNewHeader)[\'"]?>/g, "class=\'$1\' aboneWord=\'<ABONEWORD/>\'>")\n\
							.replace(\'<dd ondblclick="javascript:ChgFontstyle(event);">\',\n\
									"<dd ondblclick=\'javascript:ChgFontstyle(event);\' aboneWord=\'<ABONEWORD/>\'>")\n\
							.replace(\'<h2 class="ng">\', \'<h2 class="ng" aboneWord="<ABONEWORD/>">\');\n\
					}\n\
					if(typeof ChaikaAboneManager2 !== "undefined" && ChaikaCore.pref.getBool(\'abone.show_reason_on_thread\')){\n\
						_res = _res.replace(/<ABONEWORD\\/>/g, aAboneWord || "");\n\
					}\n\
					return _res');

				//保存
				ChaikaCore.io.writeData(file, data);

				//完了を通知
				prompts.alert(null, "Chaika Abone Helper Setup", decodeURIComponent(escape('正常に書き換えが完了しました.')));
			}
		}
	}
};
