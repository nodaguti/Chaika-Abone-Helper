Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const DESCRIPTION = 'CAHService js component';
const CONTRACTID = '@software.2ch.net/cah-service;1';
const CLASSID = Components.ID("{0D15B29E-52F0-11DE-9836-8EA256D89593}");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

var gService = null;


function CAHService(){
}

CAHService.prototype = {

	_startup: function CAHService__startup(){
		Components.utils.import("resource://cah/ChaikaAboneManager+.js");
		ChaikaAboneManager2._startup();
	},

	_quit: function CAHService__quit(){
		ChaikaAboneManager2._quit();
	},


	// *************** implements nsIObserver ***************
	observe: function CAHService_observe(aSubject, aTopic, aData){
		var os = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

		switch(aTopic){
			case 'app-startup':
				os.addObserver(this, "profile-after-change", false);
				break;

			case "profile-after-change":
				os.addObserver(this, "quit-application", false);
				this._startup();
				break;

			case "quit-application":
				this._quit();
				os.removeObserver(this, 'quit-application');
				break;
		}
	},


	// *************** XPCOMUtils Component Registration ***************

	classDescription: DESCRIPTION,
	contractID: CONTRACTID,
	classID: CLASSID,
	_xpcom_categories: [{category: "app-startup",
						 service: true,
						 entry: DESCRIPTION,
						 value: CONTRACTID
						}],
	_xpcom_factory: {
		createInstance: function(aOuter, aIID) {
			if(aOuter != null) throw Cr.NS_ERROR_NO_AGGREGATION;
			if(!gService) gService = new CAHService();

			return gService.QueryInterface(aIID);
		}
	},

	// nsISupports
	QueryInterface: XPCOMUtils.generateQI([
		Ci.fgICAHService,
		Ci.nsISupportsWeakReference,
		Ci.nsIObserver,
		Ci.nsISupports
	])
};


if (XPCOMUtils.generateNSGetFactory) {
	// Firefox >= 4
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([CAHService]);
} else {
	// Firefox <= 3.6.*
	var NSGetModule = function(aCompMgr, aFileSpec){
		return XPCOMUtils.generateModule([CAHService]);
	}
}
