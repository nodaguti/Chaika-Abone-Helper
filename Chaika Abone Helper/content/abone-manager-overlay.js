Components.utils.import("resource://chaika-modules/ChaikaCore.js");
Components.utils.import("resource://chaika-modules/ChaikaAboneManager.js");
Components.utils.import("resource://cah/ChaikaAboneManager+.js");

function startup_helper(){
	//タブを作成
	var tab = document.createElement('tab');
	tab.setAttribute('label', '高度な設定');
	document.getElementsByTagName('tabs')[0].appendChild(tab);

	var helperTab = document.getElementById('aboneHelperTab'),
		pos = document.getElementById('aboneWordListBox').parentNode,
		range = document.createRange();

	range.setStartAfter(pos);
	range.insertNode(helperTab);

	//あぼーんリストを作成
	initAboneList(ChaikaAboneManager2._aboneDataObj["adv"]);

	//最初の項目を選択しておく
	//遅延を入れないと, 一番上の項目だけ
	//選択した時に背景色が変わらなくなる
	setTimeout(function(){ document.getElementById('aboneHelperListBox').selectedIndex = 0; }, 0);

	//デフォルトでタイトル自動設定
	document.getElementById('aboneTitle').disabled =
	document.getElementById('autoSetTitle').checked = true;

	//有効期限関連のイベント登録
	document.getElementById('enableExpire').addEventListener('command', function(e){
		var date = this.nextSibling;
		var time = date.nextSibling;

		date.disabled = time.disabled = !this.checked;
	}, false);

	//右クリックあぼーんの時
	if('arguments' in window && window.arguments.length > 0 && typeof window.arguments[0] === 'object'){
		//該当するタブを選択
		var textbox = document.getElementById('abone' + window.arguments[0].type + 'TextBox');
		var tabpanel = textbox.parentNode.parentNode;
		var tabbox = document.getElementById('aboneManagerTabBox');
		tabbox.selectedPanel = tabpanel;
		tabbox.selectedIndex = tabpanel.parentNode.selectedIndex;

		if(window.arguments[0].type != 'ADV'){
			textbox.value = window.arguments[0].word.conditions[0];
		}else{
			setTimeout(function(){
				addAbone2();
				initAboneInfo(window.arguments[0].word);
				setTitle();
			}, 0);
		}
	}
}

function shutdown_helper(){

	//追加しただけで無編集なものを自動的に削除する
	var aboneData = ChaikaAboneManager2._aboneDataObj["adv"];
	var abone;

	for(let i=aboneData.length-1;i>=0;i--){
		abone = aboneData[i];

		if(abone.title == 'Untitled' && abone.conditions[0].type == 'RES' &&
			abone.conditions[0].strType == 'STR' && abone.conditions[0].str == '' &&
			abone.conditions[0].andor == 'AND' && abone.targetType == 'RES' &&
			abone.conditions[0].condStr == '!=='){
				ChaikaAboneManager2.removeAbone(i);
		}
	}

}

function openPreference(){
	window.openDialog('chrome://cah/content/prefs.xul', "_blank", "chrome, resizable, toolbar");
}

function initAboneList(aboneData){
	if(!aboneData) return;
	var listbox = document.getElementById('aboneHelperListBox');

	while(listbox.getRowCount() > 0){
		listbox.removeItemAt(0);
	}

	for(let i=0, l=aboneData.length; i<l; i++){
		listbox.appendItem(aboneData[i].title, aboneData[i].title);
	}
}

//あぼーんデータを描画
// index: あぼーんオブジェクト または index
//        無指定なら新規作成
function initAboneInfo(index){
	var conds = document.getElementsByClassName('condition');

	//画面をクリア
	while(conds.length > 0){
		conds[0].parentNode.removeChild(conds[0]);
	}

	var title = document.getElementById('aboneTitle'),
		targetType = document.getElementById('targetType');

	var abone;

	if(typeof index === 'object'){
		//あぼーんオブジェクトが渡されたときはわざわざ配列から取ってくる必要はない
		abone = index;
	}else if(index === -1){
		//どのデータも選択されてないときはタイトルを空にする
		title.value = '';
		return;
	}else if(typeof index === 'number'){
		//指定されたindexのデータを描画
		var aboneData = ChaikaAboneManager2._aboneDataObj["adv"];
		if(aboneData[index]) abone = aboneData[index];
	}

	if(!abone){
		//新規作成
		abone = {
			title: 'Untitled',
			targetType: 'RES',
			conditions: [{
				type: 'RES',
				strType: 'STR',
				str: '',
				andor: 'AND',
				condStr: '!==',
				ignoreCase: false
			}]
		};
	}

	//タイトル
	title.value = abone.title;

	//対象
	targetType.value = abone.targetType;

	//有効期限
	var enableExpire = document.getElementById('enableExpire');
	var date = document.getElementById('expire_date');
	var time = document.getElementById('expire_time');

	if(typeof abone.expire == 'number' && abone.expire > 0){
		enableExpire.checked = true;
		date.disabled = time.disabled = false;

		var expire = new Date(abone.expire);

		date.year = expire.getFullYear();
		date.month = expire.getMonth();
		date.date = expire.getDate();
		time.hour = expire.getHours();
		time.minute = expire.getMinutes();
	}else{
		enableExpire.checked = false;
		date.disabled = time.disabled = true;
		time.hour = 0;
		time.minute = 0;
	}

	//透明あぼーん
	if(typeof abone.hide == 'boolean'){
		document.getElementById('hideAbone').value = abone.hide.toString().toUpperCase();
	}else{
		document.getElementById('hideAbone').value = 'DEFAULT';
	}

	//連鎖あぼーん
	if(typeof abone.chain == 'boolean'){
		document.getElementById('chainAbone').value = abone.chain.toString().toUpperCase();
	}else{
		document.getElementById('chainAbone').value = 'DEFAULT';
	}

	//自動NGID
	if(typeof abone.autoNGID == 'boolean'){
		document.getElementById('autoNGID').checked = abone.autoNGID;
	}else{
		document.getElementById('autoNGID').checked = false;
	}

	//条件
	for(let i=0,l=abone.conditions.length;i<l;i++){
		var condNode = insertNewCondition(),
			type = condNode.getElementsByClassName('abone-adv-type')[0],
			strType = condNode.getElementsByClassName('abone-adv-str-type')[0],
			str = condNode.getElementsByClassName('abone-adv-str')[0],
			andor = condNode.getElementsByClassName('abone-adv-andor')[0],
			condStr = condNode.getElementsByClassName('abone-adv-cond-str')[0],
			ignoreCase = condNode.getElementsByClassName('ignoreCase')[0];

		type.value = abone.conditions[i].type;
		strType.value = abone.conditions[i].strType;
		str.value = abone.conditions[i].str;
		andor.value = abone.conditions[i].andor;
		condStr.value = abone.conditions[i].condStr || '!==';
		ignoreCase.checked = abone.conditions[i].ignoreCase || false;
	}

	//タイトル自動設定
	var title = title.value;
	var autoTitle = getTitle(getAboneObject());
	title.disabled =
	document.getElementById('autoSetTitle').checked = (title == autoTitle || title == 'Untitled');
}

function addAbone2(){
	var listbox = document.getElementById('aboneHelperListBox');
	listbox.selectItem( listbox.appendItem('Untitled', 'Untitled') );

	var aboneStr = getAboneStr();
	ChaikaAboneManager2.addAbone(aboneStr);

	initAboneInfo();
}

function removeAbone2(){
	var listbox = document.getElementById('aboneHelperListBox');
	var index = listbox.selectedIndex;
	if(index == -1) return;

	listbox.selectedIndex = index-1;

	ChaikaAboneManager2.removeAbone(index);
	listbox.removeItemAt(index);
}

function editAbone(){
	if(document.getElementById('autoSetTitle').checked){
		setTitle();
	}

	if(!validateCondition()) return;

	var listbox = document.getElementById('aboneHelperListBox');
	var title = document.getElementById('aboneTitle');
	var aboneStr = getAboneStr();

	var result = ChaikaAboneManager2.editAbone(listbox.selectedIndex, aboneStr);

	if(result){
		return alert('条件が不正です.\n' + result);
	}

	listbox.selectedItem.setAttribute('label', title.value);
	listbox.selectedItem.setAttribute('value', title.value);
}

function validateCondition(){
	var aboneObj = getAboneObject();

	//スレッドあぼーんで無効な条件のチェック
	if(aboneObj.targetType === 'THREAD'){

		if(typeof aboneObj.chain === 'boolean'){
			alert('連鎖あぼーんはスレッドには適用できません.');
			return false;
		}

		if(aboneObj.autoNGID){
			alert('自動NGID機能はスレッドでは使用できません.');
			return false;
		}

		return !(aboneObj.conditions.some(function(cond){
			if(/(?:NAME|MAIL|DATE|IP|HOST|RES|BEID|BEBASEID)/.test(cond.type)){
				alert('スレッドあぼーんで適用できない条件が含まれています.\n' +
						'適用可能な条件は以下の通りです:\n' +
						'スレタイ, 板URL, スレURL');
				return true;
			}
		}));
	}

	//条件チェック
	if(aboneObj.conditions.some(function(cond){
		if(cond.strType === 'STR'){
			//文字列の場合, "は\"とする必要がある
			if(/[^\\]"/.test(cond.str)){  //"
				alert("「\"」がエスケープされていません.");
				return true;
			}
		}else if(cond.strType === 'REG'){
			//正規表現を「/」で囲う必要はない
			if(cond.str[0] === '/' && cond.str[cond.str.length-1] === '/'){
				alert("正規表現を「/」で囲う必要はありません.");
				return true;
			}
		}
	})){
		return false;
	}

	//有効期限
	var now = (new Date()).getTime();
	if(aboneObj.expire && aboneObj.expire < now){
		alert('有効期限が過去の日時に設定されています.');
		return false;
	}

	//すべて通過
	return true;
}

function getAboneObject(){
	//条件
	var conditions = document.getElementsByClassName('condition'),
		types = document.getElementsByClassName('abone-adv-type'),
		strTypes = document.getElementsByClassName('abone-adv-str-type'),
		strs = document.getElementsByClassName('abone-adv-str'),
		andors = document.getElementsByClassName('abone-adv-andor'),
		condStrs = document.getElementsByClassName('abone-adv-cond-str'),
		ignoreCases = document.getElementsByClassName('ignoreCase');

	//その他設定
	var title = document.getElementById('aboneTitle').value,
		targetType = document.getElementById('targetType').value,
		enableExpire = document.getElementById('enableExpire').checked,
		_exDate = document.getElementById('expire_date'),
		_exTime = document.getElementById('expire_time'),
		expire = new Date(_exDate.year, _exDate.month, _exDate.date,
							_exTime.hour, _exTime.minute, 0, 0),
		hideAbone = document.getElementById('hideAbone').value,
		chainAbone = document.getElementById('chainAbone').value,
		autoNGID = document.getElementById('autoNGID').checked;

	var aboneObject = {
		title: title,
		targetType: targetType,
		expire: enableExpire ? expire.getTime() : undefined,
		chain: undefined,
		hide: undefined,
		autoNGID: autoNGID,
		conditions: []
	};

	//透明・連鎖あぼーん
	switch(hideAbone){
		case 'TRUE': aboneObject.hide = true; break;
		case 'FALSE': aboneObject.hide = false; break;
	}

	switch(chainAbone){
		case 'TRUE': aboneObject.chain = true; break;
		case 'FALSE': aboneObject.chain = false; break;
	}

	//条件を反映
	for(let i=0,l=conditions.length;i<l;i++){
		var condObj = {
			type: types[i].value,
			strType: strTypes[i].value,
			str: strs[i].value,
			andor: andors[i].value,
			condStr: condStrs[i].value || '!==',
			ignoreCase: ignoreCases[i].checked
		};

		if(condObj.ignoreCase && condObj.strType == 'STR')
			condObj.str = condObj.str.toLowerCase();

		//追加
		aboneObject.conditions[aboneObject.conditions.length] = condObj;
	}

	return aboneObject;
}

function getAboneStr(){
	var aboneObject = getAboneObject();
	var aboneStr = JSON.stringify(aboneObject);
	return aboneStr;
}

function getTitle(aboneObject){
	var title = '';

	aboneObject.conditions.forEach(function(aElement, aIndex, aArray){
		var type,andor,isNot;

		switch(aElement.type){
			case 'NAME': type = '名前'; break;
			case 'MAIL': type = 'メール'; break;
			case 'DATE': type = '日付'; break;
			case 'IP': type = '発信元'; break;
			case 'HOST': type = 'ホスト'; break;
			case 'RES': type = '本文'; break;
			case 'BEID': type = 'BeID'; break;
			case 'BEBASEID': type = 'Be基礎番号'; break;
			case 'THREAD': type = 'スレタイ'; break;
			case 'BOARD': type = '板URL'; break;
			case 'THREAD_URL': type = 'スレURL'; break;
			default: type = aElement.type; break;
		}
		if(aElement.andor == 'AND') andor = ' かつ ';
		else andor = ' または ';

		switch(aElement.condStr){
			case '!==': isNot = ' を含む'; break;
			case '===': isNot = ' を含まない'; break;
			case 'ALL_EQUAL': isNot = ' に一致する'; break;
			case 'NOT_EQUAL': isNot = ' に一致しない'; break;
			default: isNot = ' である'; break;
		}

		title += type + 'が ' + aElement.str + isNot + andor;
	});

	title = title.replace(/(?:または|かつ)\s*$/,'');

	if(aboneObject.targetType == 'RES') title += 'レス';
	else title += 'スレ';

	return title;
}

function setTitle(){
	var aboneObj = getAboneObject();
	document.getElementById('aboneTitle').value = getTitle(aboneObj);
}

function setAsOnlyToday(){
	var enableExpire = document.getElementById('enableExpire');
	var date = document.getElementById('expire_date');
	var time = document.getElementById('expire_time');

	enableExpire.checked = true;
	date.disabled = time.disabled = false;

	var now = (new Date()).getTime();
	var expire = new Date(now + 24 * 60 * 60 * 1000);

	date.year = expire.getFullYear();
	date.month = expire.getMonth();
	date.date = expire.getDate();
	time.hour = 0;
	time.minute = 0;
}

function insertNewCondition(shouldChangeTitle){
	var range = document.createRange(),
		tmp = document.getElementById('tmp_condition'),
		newCondition = tmp.cloneNode(true);

	newCondition.removeAttribute('id');
	newCondition.removeAttribute('collapsed');
	newCondition.setAttribute('class', 'condition');
	newCondition.setAttribute('style', 'margin: 0.5em;');

	range.setStartBefore(tmp);
	range.insertNode(newCondition);

	if(shouldChangeTitle && document.getElementById('autoSetTitle').checked) setTitle();

	return newCondition;
}

function deleteCondition(event){
	var delCondition = event.originalTarget.parentNode.parentNode;
	if(document.getElementsByClassName('condition').length < 2) return;
	delCondition.parentNode.removeChild(delCondition);

	if(document.getElementById('autoSetTitle').checked) setTitle();
}
