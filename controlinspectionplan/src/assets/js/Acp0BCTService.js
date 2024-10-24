// Copyright (c) 2022 Siemens

/**
 * @module js/Acp0BCTService
 */
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import messagingSvc from 'js/messagingService';
import logger from 'js/logger';
import appCtxService from 'js/appCtxService';
import dms from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';
import acp0BCTInspCompRenderService from 'js/Acp0BCTInspCompRenderService';
import preferenceSvc from 'soa/preferenceService';
import tcSessionData from 'js/TcSessionData';
import acp0BCTInspUtilService from 'js/Acp0BCTInspUtilService';
import awSvrVer from 'js/TcAWServerVersion';
import viewModelObjectService from 'js/viewModelObjectService';
import commonUtils from 'js/Acp0CommonUtils';
//Register the default value to show reference part list to show panel
appCtxService.registerCtx( 'showReferencePartList', true );
//Register the part list view mode initial value
appCtxService.registerCtx( 'refPartListView', true );
//Map of property name and disply value for reference part table in part to inspect table
var _mapOfColPropNameAndDisplayNameForRefPart = new Map();
//Direct drawing rendering required class level variables
var _selectedPartForDirectDrawing;
var _charUidsOfImpPMIForDirectDrawing;
//Register objectset to get MCI0Pmi object to render direct drawing in PMI Tab
appCtxService.registerCtx( 'viewMci0PMIObjectSet' );
//Registering the required contex var/object in context model
appCtxService.registerCtx( 'selectedPart', undefined );
appCtxService.registerCtx( 'bctInspSelection', undefined );
//Register objectset to get all selected balloons from multisheet
appCtxService.registerCtx( 'allSelectedBalloons', undefined );
appCtxService.registerCtx( 'charUidsOfImpPMI', undefined );
appCtxService.registerCtx( 'selectedSheet', undefined );
appCtxService.registerCtx( 'fileTypeOfProject', undefined );
appCtxService.registerCtx( 'projectToRenderBctComponent', undefined );
appCtxService.registerCtx( 'drawingSheetList', undefined );
appCtxService.registerCtx( 'isActiveTabIdIsPMI', undefined );
//Register the default value to show compare part revisions list to show panel
appCtxService.registerCtx( 'showComparePartRevisionsList', false );
//Base revision Project selection default value
appCtxService.registerCtx( 'baseRevisionSelection', undefined );
//Base part selection
appCtxService.registerCtx( 'baseSelectedPart', undefined );
//To Check PMIs are imported sucessfully
appCtxService.registerCtx( 'isImportedPMIS', false );

//Prefefence value for tolerence type
var _mprefValueForTolarence;
var _mprefNames = [ 'AQC_VarCharSpecToleranceType' ];
//Prefefence value for default PSE_default_view_type to get PMI object
var _mprefPSEdefaultviewtypeValue;
var _mprefPSEdefaultviewtype = 'PSE_default_view_type';
//Prefefence for input creation in import PMI process.
var _mprefValueIpxmlKeysforCreateInput = [];
var _mprefNamesForCreateInput = [ 'ACP_IPXMLKEY_TCQPROPS_MAPPING', 'Mci0PMIImportNxToTcPropertiesMap', 'ACP_IPXMLKEY_INSPDEFPROPS_MAPPING' ];
//Prefefence to decide Sync Async call for import PMI process.
var _mprefNameToDecideSyncAsyncCall = [ 'ACP_Config_SyncAsync_Import_Balloon_Call' ];
var _mprefToDecideSyncAsyncCallValue;
var exports = {};

/*
 *  Prepare Drawing rendering informnation to proceed Drawing rendering as part of BCT component
 *  @param {Object} data view model object
 */
export let getPartCharacteristics = function( subPanelContext ) {
    //As part of BA reading ctx object here itself
    let ctx = appCtxService.ctx;

    //Check and set the BCT License key
    //once the BCT npm support enable will uncomment Licensekey check
    acp0BCTInspCompRenderService.readAndSetLicenseKey();
    //ctx.selectedPart = undefined;
    //Call preference service to read preference for tolarence type
    if( !_mprefValueForTolarence ) {
        exports.getPreferenceValues( _mprefNames );
    }

    if( _mprefValueIpxmlKeysforCreateInput.length === 0 ) {
        exports.readPrefValueForCreateInputInImportPMIProcess( _mprefNamesForCreateInput );
    }

    if( !_mprefToDecideSyncAsyncCallValue ) {
        exports.getPreferenceValuesForSyncAsyncImportPMI( _mprefNameToDecideSyncAsyncCall );
    }

    //Version check required as import PMI itk implementation changed from tc13.1 onwards, It impacts the import PMI SOA input
    if( ctx.isAW13X_OnwardsSupported === undefined || ctx.isTC13_1OnwardsSupported === undefined ) {
        exports.getSupportedTCVersion();
    }
    //To Call Part List Data Provider once loaded the Ballooning tab for backportsupport on AW5.2
    if( ctx.isTC13_1OnwardsSupported === false ) {
        eventBus.publish( 'Acp0.callPartListDataProvider' );
    }
    //Reset the BCT Inspector Balloon selection, charUId of imported PMI, selectedsheet,file type and project object.
    //In same user session reloading the component should reset the below context values.
    appCtxService.updateCtx( 'bctInspSelection', undefined );
    appCtxService.updateCtx( 'allSelectedBalloons', undefined );
    appCtxService.updateCtx( 'charUidsOfImpPMI', undefined );
    appCtxService.updateCtx( 'selectedSheet', undefined );
    appCtxService.updateCtx( 'fileTypeOfProject', undefined );
    appCtxService.updateCtx( 'projectToRenderBctComponent', undefined );
    appCtxService.updateCtx( 'showReferencePartList', true );
    appCtxService.updateCtx( 'isActiveTabIdIsPMI', undefined );
    appCtxService.updateCtx( 'showComparePartRevisionsList', false );
    appCtxService.updateCtx( 'isImportedPMIS', false );
    appCtxService.updateCtx( 'isHideLinkedParts', false );
    var objectSetElement;
    // var objectSet = document.getElementsByTagName('aw-walker-objectset');
    //Rmoved object set titlekey to verify Drawing section in PMI tab - Not required in AW6.0 BA/AW6.1
    //Removed event on splm table row if it is part of PMI section(XRT) - Not required in AW6.0 BA/AW6.1
    //Get the Part from Inspection Definition
    var activeTabPageId = subPanelContext && subPanelContext.activeTab ? subPanelContext.activeTab.pageId : '';
    if( activeTabPageId === 'tc_xrt_PMI' ) {
        exports.readDefaultPSEViewTypeForPMI();
    }
};

/**
 * This method to get pref PSE_default_view_type value
 */
export let readDefaultPSEViewTypeForPMI = function() {
    if( !_mprefPSEdefaultviewtypeValue ) {
        preferenceSvc.getStringValue( _mprefPSEdefaultviewtype ).then( function( result ) {
            if( result !== '' && result !== null ) {
                _mprefPSEdefaultviewtypeValue = result;
            } else {
                _mprefPSEdefaultviewtypeValue = 'view';
            }
            //appCtxService.ctx.viewMci0PMIObjectSet = _mprefPSEdefaultviewtypeValue + '.Mci0PMI';
            appCtxService.updateCtx( 'viewMci0PMIObjectSet', _mprefPSEdefaultviewtypeValue + '.Mci0PMI' );
            eventBus.publish( 'Acp0.getPartForDirectRenderingInPMITab' );
        } );
    } else {
        eventBus.publish( 'Acp0.getPartForDirectRenderingInPMITab' );
    }
};

/*
 * To Process the Drawing rendering once user selects the part from PMI tab,Cad View/Ballooning Tab and Part List
 */
export let processDrawingRenderingDataBasedOnSelectionChange = function( data, subPanelContext, objectSetElementSelection, eventData, balloonUidsToHighlight ) {
    //Reset the BCT Inspector Balloon selection
    appCtxService.updateCtx( 'bctInspSelection', undefined );
    appCtxService.updateCtx( 'charUidsOfImpPMI', undefined );
    appCtxService.updateCtx( 'allSelectedBalloons', undefined );
    var selectedObject;
    if( eventData && eventData.selectedUids && eventData.selectedUids.length !== 0 || objectSetElementSelection ) {
        // object set row selection check
        selectedObject = objectSetElementSelection ? eventData[ 0 ] : cdm.getObject( eventData.selectedUids[ 0 ].uid );
    }

    if( balloonUidsToHighlight && balloonUidsToHighlight.length > 0 ) {
        appCtxService.updateCtx( 'charUidsOfImpPMI', balloonUidsToHighlight );
    }

    var activeTabPageId = subPanelContext && subPanelContext.activeTab ? subPanelContext.activeTab.pageId : '';
    if( activeTabPageId === 'tc_xrt_PMI' && selectedObject ) {
        appCtxService.updateCtx( 'inspCombineViewMode', false );
        appCtxService.updateCtx( 'inspDrawingViewMode', true );
        appCtxService.updateCtx( 'inspTableViewMode', false );
        appCtxService.updateCtx( 'isActiveTabIdIsPMI', true );
        if( objectSetElementSelection ) {
            appCtxService.updateCtx( 'selectedPart', cdm.getObject( selectedObject.props.mci0PMIReferencePart.dbValues[ 0 ] ) );
            appCtxService.updateCtx( 'charUidsOfImpPMI', [ selectedObject.props.mci0PMICharacteristicsUid.dbValues[ 0 ] ] );
        } else {
            appCtxService.updateCtx( 'selectedPart', selectedObject );
        }
    } else if( activeTabPageId === 'tc_xrt_CAD_View' && selectedObject && selectedObject.type === 'Awp0XRTObjectSetRow' ) {
        // Below check required when Cad View tab has Drawing section with table(AW_12x).
        //If aw6.0_12x applicable then below code block needs to be cahnge as selected part is not getting correct.
        let selectedPart = cdm.getObject( selectedObject.props.items_tag.dbValues[ 0 ] );
        appCtxService.updateCtx( 'selectedPart', cdm.getObject( selectedObject.props.items_tag.dbValues[ 0 ] ) );
    } else if( activeTabPageId === 'tc_xrt_PMI' && !selectedObject ) {
        appCtxService.updateCtx( 'selectedPart', _selectedPartForDirectDrawing );
        appCtxService.updateCtx( 'charUidsOfImpPMI', _charUidsOfImpPMIForDirectDrawing );
        appCtxService.updateCtx( 'inspCombineViewMode', false );
        appCtxService.updateCtx( 'inspDrawingViewMode', true );
        appCtxService.updateCtx( 'inspTableViewMode', false );
        //ctx.selectedPart = _selectedPartForDirectDrawing;
        //ctx.charUidOfImpPMI = _charUidsOfImpPMIForDirectDrawing;
        //Prepare and Render the BCT Inspector based on view mode selection.
        //acp0BCTInspCompRenderService.getProjectAndRenderBCTInspViewer(ctx, data);
    } else {
        let selectedPart = selectedObject === null ? eventData.selectedObjects[ 0 ] : selectedObject;
        appCtxService.updateCtx( 'selectedPart', selectedPart );
    }

    //Prepare and Render the BCT Inspector based on view mode selection.
    return acp0BCTInspCompRenderService.getProjectAndRenderBCTInspViewer( appCtxService.ctx, data );
};

/*
 * To read the preference and preference values
 */
export let getPreferenceValues = function( prefNames ) {
    var prefPromise = preferenceSvc.getStringValues( prefNames );
    if( prefPromise ) {
        prefPromise.then( function( prefValues ) {
            if( !prefValues ) {
                return _mprefValueForTolarence = 'Relative';
            }
            return _mprefValueForTolarence = prefValues[ 0 ];
        } );
    } else {
        return _mprefValueForTolarence = 'Relative';
    }
};

/*
 * To read the preference and preference values
 *  @param {Array} prefNames to read the preference values
 */
export let readPrefValueForCreateInputInImportPMIProcess = function( prefNames ) {
    var deferred = AwPromiseService.instance.defer();
    preferenceSvc.getMultiStringValues( prefNames ).then(
        function( prefs ) {
            for( var prefName of _mprefNamesForCreateInput ) {
                var prefNameAndValues = prefs[ prefName ];
                if( prefNameAndValues ) {
                    for( var prefValue of prefNameAndValues ) {
                        var prefValueIpxmlKeys = prefValue.split( ':' )[ 0 ];
                        if( _mprefValueIpxmlKeysforCreateInput.indexOf( prefValueIpxmlKeys ) === -1 ) {
                            _mprefValueIpxmlKeysforCreateInput.push( prefValueIpxmlKeys );
                        }
                    }
                }
            }
            deferred.resolve( _mprefValueIpxmlKeysforCreateInput );
        } );
    return deferred.promise;
};

/*
 * To read the preference and preference values
 */
export let getPreferenceValuesForSyncAsyncImportPMI = function( prefNames ) {
    var prefPromise = preferenceSvc.getStringValues( prefNames );
    if( prefPromise ) {
        prefPromise.then( function( prefValues ) {
            if( !prefValues ) {
                return _mprefToDecideSyncAsyncCallValue = 0;
            }
            return _mprefToDecideSyncAsyncCallValue = prefValues[ 0 ];
        } );
    } else {
        return _mprefToDecideSyncAsyncCallValue = 0;
    }
};

// Method to check the version support
export let getSupportedTCVersion = function() {
    var tcMajor = tcSessionData.getTCMajorVersion();
    var tcMinor = tcSessionData.getTCMinorVersion();
    // tc 13.1 onwards supported
    if( tcMajor === 13 && tcMinor >= 1 || tcMajor > 13 ) {
        appCtxService.registerCtx( 'isTC13_1OnwardsSupported', true );
    } else {
        appCtxService.registerCtx( 'isTC13_1OnwardsSupported', false );
    }
    //tc 13.0 onwards/AW5.2_13X support
    //get Aw Server version
    var awServerVersion = awSvrVer.baseLine;
    awServerVersion = awServerVersion.split( 'x' )[ 0 ];
    if( awServerVersion >= 'aw5.2.0.13' ) {
        appCtxService.registerCtx( 'isAW13X_OnwardsSupported', true );
    } else {
        appCtxService.registerCtx( 'isAW13X_OnwardsSupported', false );
    }
};

/*
 * @param {Object} ctx context Object
 * @param {Object} data from declarative view model
 */
export let callBCTServiceToGetReduceIpxml = function( ctx, data ) {
    //Version check required as import PMI itk implementation changed from tc13.1 onwards, It impacts the import PMI SOA input
    if( appCtxService.ctx.isTC13_1OnwardsSupported === undefined ) {
        exports.getSupportedTCVersion();
    }
    //Based on version check import PMI SOA inputs changes to process the import PMI functinality.
    appCtxService.ctx.isTC13_1OnwardsSupported === false ? exports.callBCTServiceToGetReduceIpxml_TCVersionBackPortSupport( ctx, data ) : callSOAForimportPMIInControlPlanStruct( appCtxService.ctx,
        data );
};

/*
 * To support functionality AW5.2 + tc13.0 or applicable prior versions. Its backport Support.
 * @param {Object} ctx context Object
 * @param {Object} data from declarative view model
 */
export let callBCTServiceToGetReduceIpxml_TCVersionBackPortSupport = function( ctx, data ) {
    // To create Map of charUIdBalloonObject
    var charUIdBalloonObjectMap = new Map();
    var CharUIdReduceIpxmlFileStringMap = new Map();
    if( ctx.allSelectedBalloons ) {
        for( var sc = 0; sc < ctx.allSelectedBalloons.length; sc++ ) {
            var selectedBalloon = ctx.allSelectedBalloons[ sc ];
            if( selectedBalloon ) {
                //To fix customer specific data that colum "K2504" should have value 2 to create PMI object
                if( selectedBalloon.props.get( 'K2504' ) !== '2' ) {
                    selectedBalloon.props.set( 'K2504', '2' );
                }
                charUIdBalloonObjectMap.set( selectedBalloon.id, selectedBalloon );
            }
        }
    }
    //Call BCT service API for to get reduce ipxml as string.
    var charToIpxmlInput = {
        itemId: ctx.selectedPart.props.item_id.dbValues[ 0 ],
        itemRevisionId: ctx.selectedPart.props.item_revision_id.dbValues[ 0 ],
        characteristics: charUIdBalloonObjectMap
    };
    acp0BCTInspUtilService.characteristicToIPXML( charToIpxmlInput ).then( values => {
        for( var each of values.entries() ) {
            CharUIdReduceIpxmlFileStringMap.set( each[ 0 ], each[ 1 ] );
        }
        ctx.CharUIdReduceIpxmlFileStringMapInContext = CharUIdReduceIpxmlFileStringMap;
        callSOAForimportPMIInControlPlanStruct( appCtxService.ctx, data );
    } );
};

/*
 * @param {Object} ctx context Object
 */
export let importPmiInControlPlanStructInput = function( ctx ) {
    //Process the BCT Inspector selection event data to Import PMI
    var importPmiInControlPlanStructInputs = [];
    if( ctx.allSelectedBalloons ) {
        for( var sc = 0; sc < ctx.allSelectedBalloons.length; sc++ ) {
            var importPmiInControlPlanStructInput = {
                createcharInput: {
                    boName: 'String',
                    stringProps: {},
                    boolArrayProps: {},
                    tagProps: {},
                    tagArrayProps: {},
                    stringArrayProps: {},
                    doubleProps: {},
                    doubleArrayProps: {},
                    floatProps: {},
                    floatArrayProps: {},
                    intProps: {},
                    intArrayProps: {},
                    boolProps: {}
                },
                bctCharUID: ''
            };
            var qc0LowerTolerance;
            var qc0UpperTolerance;
            var qc0LowerToleranceString = '';
            var qc0UpperToleranceString = '';
            var mci0IsAbsolutePMI;
            var qc0ToleranceType;
            var selectedBalloon = ctx.allSelectedBalloons[ sc ];
            if( selectedBalloon ) {
                // When we create ipxml file through workflow then in this ipxml file keys are not added if no value
                // exists corresponding to it, In such case we need to set required key with defult value.
                // Set default value for required keys if corresponding value is missing on selected balloon.
                const numKeys = [ 'K2101', 'K2110', 'K2111', 'K2112', 'K2113' ];
                for( var keyIndex = 0; keyIndex < numKeys.length; keyIndex++ ) {
                    if( !selectedBalloon.props.get( numKeys[ keyIndex ] ) ) {
                        selectedBalloon.props.set( numKeys[ keyIndex ], '0' );
                    }
                }
                const textKeys = [ 'B2005', 'B2009' ];
                for( var keyIndex = 0; keyIndex < textKeys.length; keyIndex++ ) {
                    if( !selectedBalloon.props.get( textKeys[ keyIndex ] ) ) {
                        selectedBalloon.props.set( textKeys[ keyIndex ], '' );
                    }
                }
                if( !selectedBalloon.props.get( 'K2504' ) ) {
                    selectedBalloon.props.set( 'K2504', '2' );
                }

                //Based on tolerance type preparing the input
                switch ( _mprefValueForTolarence ) {
                    case 'Relative':
                        qc0LowerTolerance = Number( selectedBalloon.props.get( 'K2112' ) );
                        qc0UpperTolerance = Number( selectedBalloon.props.get( 'K2113' ) );
                        qc0LowerToleranceString = selectedBalloon.props.get( 'K2112' ).toString();
                        qc0UpperToleranceString = selectedBalloon.props.get( 'K2113' ).toString();
                        mci0IsAbsolutePMI = 'False';
                        qc0ToleranceType = _mprefValueForTolarence;
                        break;
                    case 'Absolute':
                        qc0LowerTolerance = Number( selectedBalloon.props.get( 'K2110' ) );
                        qc0UpperTolerance = Number( selectedBalloon.props.get( 'K2111' ) );
                        qc0LowerToleranceString = selectedBalloon.props.get( 'K2110' ).toString();
                        qc0UpperToleranceString = selectedBalloon.props.get( 'K2111' ).toString();
                        mci0IsAbsolutePMI = 'True';
                        qc0ToleranceType = _mprefValueForTolarence;
                        break;
                    default:
                        //Nothing to do
                }
                var bctCharUId = selectedBalloon.id;
                //Start to create input for acp0 importPmi Soa
                importPmiInControlPlanStructInput.bctCharUID = bctCharUId;
                //This check is for deciding type of characteristics.Value of K2009 is in between 200-203 then its "Qc0VariableCharSpec" otherwise "Qc0AttributiveCharSpec"
                var K2009ColValue = Number( selectedBalloon.props.get( 'K2009' ) );
                var charType;
                //Added OR condition to full fill the requirement 'LCS-578384 - Support Geometrical tolerances as a part of Variable Chx while importing PMI'.
                if( K2009ColValue >= 200 && K2009ColValue <= 203 || K2009ColValue >= 100 && K2009ColValue <= 122 ) {
                    charType = 'Qc0VariableCharSpec';
                } else {
                    charType = 'Qc0AttributiveCharSpec';
                }
                importPmiInControlPlanStructInput.createcharInput.boName = charType;
                //importPmiInControlPlanStructInput.createcharInput.stringProps.object_name = ''; //if required then add
                //Passing selected Part uid to support Inspection Definition naming pattern.'LCS-555523 - Inspection Definition Naming to generic'.
                importPmiInControlPlanStructInput.createcharInput.stringProps.selectedPartUid = ctx.selectedPart.uid;
                importPmiInControlPlanStructInput.createcharInput.stringProps.object_desc = selectedBalloon.props.get( 'B2009' );
                importPmiInControlPlanStructInput.createcharInput.intProps.qc0BasedOnId = 1;
                importPmiInControlPlanStructInput.createcharInput.stringProps.qc0Context = 'Product';
                importPmiInControlPlanStructInput.createcharInput.stringProps.qc0Criticality = selectedBalloon.props.get( 'B2005' );
                if( !selectedBalloon.props.get( 'B2005' ) ) {
                    importPmiInControlPlanStructInput.createcharInput.stringProps.qc0Criticality = 'Minor';
                }
                if( charType === 'Qc0VariableCharSpec' ) {
                    //Values comming form BCT  for this attribute is not match(Some times empty) TC LOV Values so made modification for proper input
                    importPmiInControlPlanStructInput.createcharInput.stringProps.qc0UnitOfMeasure = selectedBalloon.props.get( 'K2142' );
                    importPmiInControlPlanStructInput.createcharInput.doubleProps.qc0NominalValue = Number( selectedBalloon.props.get( 'K2101' ) );
                    importPmiInControlPlanStructInput.createcharInput.doubleProps.qc0LowerTolerance = qc0LowerTolerance;
                    importPmiInControlPlanStructInput.createcharInput.doubleProps.qc0UpperTolerance = qc0UpperTolerance;
                    importPmiInControlPlanStructInput.createcharInput.doubleProps.qc0LowerAllowance = qc0LowerTolerance;
                    importPmiInControlPlanStructInput.createcharInput.doubleProps.qc0UpperAllowance = qc0UpperTolerance;
                    importPmiInControlPlanStructInput.createcharInput.stringProps.qc0ToleranceType = qc0ToleranceType;
                }
                if( charType === 'Qc0AttributiveCharSpec' ) {
                    importPmiInControlPlanStructInput.createcharInput.stringProps.qc0OkDescription = selectedBalloon.props.get( 'B2005' );
                    importPmiInControlPlanStructInput.createcharInput.stringProps.qc0NokDescription = '';
                }
                //For single SOA call we dont need to cache the selection and ballon object against the BCT CHX_UID..
                //Passing the reduce ipxmlFile as a string in the form of String property as currently(AW5.0) we dont have input of soa as map<'string',balloonObject>
                if( appCtxService.ctx.isTC13_1OnwardsSupported === false ) {
                    importPmiInControlPlanStructInput.createcharInput.stringProps.bctCharInfo = ctx.CharUIdReduceIpxmlFileStringMapInContext.get( bctCharUId );
                }
                if( appCtxService.ctx.isTC13_1OnwardsSupported === true ) {
                    var mci0ChangeStatusText = selectedBalloon.props.get( 'K2504' ).toString();
                    //Check the actually prop values which are changed by ignoring "k2504" status column value
                    var updatedPMIs = acp0BCTInspCompRenderService.getUpdatedPMIs();
                    if( mci0ChangeStatusText !== '1' && updatedPMIs && updatedPMIs.indexOf( bctCharUId ) !== -1 ) {
                        mci0ChangeStatusText = '1';
                    }

                    importPmiInControlPlanStructInput.createcharInput.stringProps.bctCharInfo = '';
                    // Set the data for PMI creation and to find char group using rule condition.
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0NominalValue = [ selectedBalloon.props.get( 'K2101' ).toString() ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0IsAbsolutePMI = [ mci0IsAbsolutePMI ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0UpperSpecLimit = [ qc0UpperToleranceString ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0LowerSpecLimit = [ qc0LowerToleranceString ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0DimensionType = [ selectedBalloon.props.get( 'B2009' ) ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0ChangeStatusText = [ mci0ChangeStatusText ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0BCTUniqueObjHandle = [ selectedBalloon.props.get( 'BCT_UNIQUE_OBJ_HANDLE' ) ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0PMICharacteristicsUid = [ bctCharUId ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0PmiID = [ selectedBalloon.props.get( 'K2002' ) ];
                    importPmiInControlPlanStructInput.createcharInput.stringArrayProps.mci0PMIReferencePart = [ ctx.selectedPart.uid ];
                }
                importPmiInControlPlanStructInputs.push( importPmiInControlPlanStructInput );
            }
        }
    }
    return importPmiInControlPlanStructInputs;
};

/*
 * @param {Object} ctx context Object
 */
export let importPmiInControlPlanStructInputForImportBalloons = function( ctx ) {
    var balloonsInfo = [];
    if( ctx.allSelectedBalloons ) {
        for( var sc = 0; sc < ctx.allSelectedBalloons.length; sc++ ) {
            var balloonInfo = {
                balloonProps: []
            };
            if( _mprefValueIpxmlKeysforCreateInput ) {
                var selectedBalloon = ctx.allSelectedBalloons[ sc ];
                if( selectedBalloon ) {
                    for( var prefValueIpxmlKey of _mprefValueIpxmlKeysforCreateInput ) {
                        var bctCharUId = selectedBalloon.id;
                        var propValue = selectedBalloon.props.get( prefValueIpxmlKey ) !== undefined ? selectedBalloon.props.get( prefValueIpxmlKey ).toString() : '';
                        if( prefValueIpxmlKey === 'K2504' ) {
                            propValue = selectedBalloon.props.get( 'K2504' ).toString();
                            var updatedPMIs = acp0BCTInspCompRenderService.getUpdatedPMIs();
                            if( propValue !== '1' && updatedPMIs && updatedPMIs.indexOf( bctCharUId ) !== -1 ) {
                                propValue = '1';
                            }
                        }
                        if( prefValueIpxmlKey === 'BCT_CHX_UID' ) {
                            propValue = bctCharUId;
                        }
                        balloonInfo.balloonProps.push( { propKey: prefValueIpxmlKey, propValue: propValue } );
                    }
                    balloonInfo.balloonProps.push( { propKey: 'selectedPartUid', propValue: ctx.selectedPart.uid } );
                    balloonInfo.balloonProps.push( { propKey: 'K2009', propValue: selectedBalloon.props.get( 'K2009' ).toString() } );
                    balloonsInfo.push( balloonInfo );
                }
            }
        }
    }
    return balloonsInfo;
};

/*
 * @param {Object} ctx context Object
 */
export let getContextObject = function( ctx ) {
    var contextObject = ctx.selected;
    if( contextObject.type !== 'Acp0ControlPlanElement' && contextObject.type !== 'Acp0InspOpElement' && contextObject.type !== 'Aqc0QcElement' ) {
        contextObject = ctx.pselected;
    }
    return contextObject;
};

export let getContextObjectUid = function( ctx ) {
    var contextObject = getContextObject( ctx );
    return contextObject.props.awb0UnderlyingObject.dbValues[ 0 ];
};
/*
 * @param {Object} ctx context Object
 * @param {Object} data from declarative view model
 */
export let callSOAForimportPMIInControlPlanStruct = function( ctx, data ) {
    var awServerVersion = awSvrVer.baseLine;
    awServerVersion = awServerVersion.split( 'x' )[ 0 ];
    if( awServerVersion >= 'aw6.2.0.13' ) {
        var balloonInfoInput = {
            balloonsInfo: importPmiInControlPlanStructInputForImportBalloons( ctx ),
            contextObject: getContextObject( ctx )
        };
        var isRunInBackground = getRunInBackgroundFlag();
        var importBalloonsInput = {
            input: balloonInfoInput,
            runInBackground: isRunInBackground
        };

        soaSvc.post( 'Internal-ControlPlan-2022-12-ControlPlanPmiImport', 'importBalloons', importBalloonsInput ).then( function( response ) {
            handleSOAResponse( response, data, balloonInfoInput, isRunInBackground );
        }, function( error ) {
            var errMessage = messagingSvc.getSOAErrorMessage( error );
            messagingSvc.showError( errMessage );
        } )
            .catch( function( exception ) {
                //Need to work on message as part of defect if required
                //var failedMessage = response.failedBalloonIds && response.failedBalloonIds.failedBalloonIds.length > 1 ?
                //data.i18n.FailedToImportPMIsImportBalloons.replace('{0}', failedBalloonIds) : data.i18n.FailedToImportPMIImportBalloons.replace('{0}', failedBalloonIds);
                logger.error( data.i18n.FailedToImportPMIs );
                logger.error( exception );
            } );
    } else {
        var methodReturnInput = importPmiInControlPlanStructInput( ctx );
        var inputData = {
            importPMIInControlPlanStructInputs: methodReturnInput,
            contextObject: getContextObject( ctx ),
            inspectionDefsIPXMLMap: [
                [],
                []
            ]
        };
        soaSvc.post( 'Internal-ControlPlan-2020-05-ControlPlanPmiImport', 'importPMIInControlPlanStruct', inputData ).then( function( response ) {
            handleSOAResponse( response, data, inputData );
        }, function( error ) {
            var errMessage = messagingSvc.getSOAErrorMessage( error );
            messagingSvc.showError( errMessage );
        } )
            .catch( function( exception ) {
                logger.error( data.i18n.FailedToImportPMIs );
                logger.error( exception );
            } );
    }
};

/*
 * @param {Object} createdPMIS context Object
 * @param {object} data object for read messages
 */
export let handleSOAResponse = function( response, data, inputData, isRunInBackground ) {
    if( !isRunInBackground ) {
        if( response.createdPMIs || response.ServiceData.created || response.ServiceData.updated || response.ServiceData.deleted ) {
            getPMINameList( response, data, isRunInBackground );
        } else {
            var failedBalloonIds = response.failedBalloonIds;
            var failedMessage = isRunInBackground !== undefined && failedBalloonIds && failedBalloonIds.length > 1 ? data.i18n.FailedToImportPMIsImportBalloons.replace( '{0}', failedBalloonIds ) : data.i18n.FailedToImportPMIImportBalloons.replace( '{0}', failedBalloonIds );
            var message = isRunInBackground !== undefined ? failedMessage : data.i18n.FailedToImportPMIs;
            messagingSvc.showError( message );
        }
    } else{
        // User will be informed if import balloons operation will get performed in asynchronous mode
        var asyncMsg = data.i18n.Acp0ImportPmiAsynchronous.replace( '{0}', _mprefToDecideSyncAsyncCallValue );
        messagingSvc.showInfo( asyncMsg );
    }

    if( inputData.contextObject !== undefined ) {
        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: [
                inputData.contextObject
            ],
            refreshLocationFlag: true
        } );
    }
    eventBus.publish( 'primaryWorkarea.reset' );
    appCtxService.updateCtx( 'baseRevisionSelection', undefined );
    appCtxService.updateCtx( 'baseSelectedPart', undefined );
};

/*
 * @param {Object} response Import PMI soa response
 * @param {object} data object for read messages
 */
export let getPMINameList = function( response, data, isRunInBackground ) {
    var propsToLoad = [];
    var uids = [];
    var importedPMIs = [];
    var createdPMI = [];
    var failedBalloonIds = [];
    //Below check required to handle 'importBalloons' and 'importPMIInControlPlanStruct' SOA Response
    var isResponseCreatedPMI = response.createdPMIs && response.createdPMIs.length > 0;
    var isRespnseServiceDataCreated = response.ServiceData.created && response.ServiceData.created.length > 0;
    var failedBalloonIds = response.failedBalloonIds;
    //if (isResponseCreatedPMI || isRespnseServiceDataCreated) {
    if( isResponseCreatedPMI ) {
        createdPMI = response.createdPMIs;
        for( var pmiInx = 0; pmiInx < createdPMI.length; pmiInx++ ) {
            importedPMIs.push( createdPMI[ pmiInx ] );
        }
    }
    if( isRespnseServiceDataCreated ) {
        createdPMI = response.ServiceData.created;
        for( var pmiInx = 0; pmiInx < createdPMI.length; pmiInx++ ) {
            importedPMIs.push( response.ServiceData.modelObjects[ createdPMI[ pmiInx ] ] );
        }
    }
    //}
    // As in response.ServiceData.updated only uid of imported PMI is present, to get the object of imported PMI we are using response.ServiceData.modelObjects
    if( response.ServiceData.updated && response.ServiceData.updated.length > 0 ) {
        for( var updatePMIInx = 0; updatePMIInx < response.ServiceData.updated.length; updatePMIInx++ ) {
            importedPMIs.push( response.ServiceData.modelObjects[ response.ServiceData.updated[ updatePMIInx ] ] );
        }
    }

    for( var importedPMIInx = 0; importedPMIInx < importedPMIs.length; importedPMIInx++ ) {
        uids.push( importedPMIs[ importedPMIInx ].uid );
        if( !importedPMIs[ importedPMIInx ].props.bl_line_name ) {
            propsToLoad.push( 'bl_line_name' );
        }
    }
    if( propsToLoad.length > 0 ) {
        dms.getProperties( uids, propsToLoad )
            .then(
                function() {
                    self.preparePMINameList( importedPMIs, failedBalloonIds, data, isRunInBackground );
                }
            );
    } else {
        self.preparePMINameList( importedPMIs, failedBalloonIds, data, isRunInBackground );
    }
};
/*
 * @param {Object} createdPMIS context Object
 * @param {object} data object for read messages
 */
self.preparePMINameList = function( importedPMIs, failedBalloonIds, data, isRunInBackground ) {
    var pmiNameList = '';
    var message = '';
    for( var importedPMIInx = 0; importedPMIInx < importedPMIs.length; importedPMIInx++ ) {
        var importedPMIsName = importedPMIs[ importedPMIInx ].props.bl_line_name.dbValues[ 0 ];
        // Changes as part of LCS-528108 - I18N: Enhancement request - the message is easy to understand
        importedPMIsName = importedPMIsName.replace( '}}', ')' ).replace( '{{', ' (' );
        //As per  impotBalloons Soa we are using PMI Id instead of Name to maintain generic naming convention in sucess, prtial and failed stage.
        if( isRunInBackground !== undefined ) {
            importedPMIsName = importedPMIsName.split( ' (' )[ 0 ];
        }
        if( importedPMIInx !== importedPMIs.length - 1 ) {
            pmiNameList = pmiNameList + importedPMIsName + ', ';
        } else {
            pmiNameList += importedPMIsName;
        }
    }
    if( importedPMIs && importedPMIs.length > 0 ) {
        if( importedPMIs.length === appCtxService.ctx.allSelectedBalloons.length ) {
            var importedMessage = importedPMIs.length > 1 && isRunInBackground !== undefined ? data.i18n.AllImportedPMIsImportBalloons.replace( '{0}', pmiNameList ) : data.i18n
                .AllImportedPMIImportBalloons.replace( '{0}', pmiNameList );
            message = isRunInBackground !== undefined ? importedMessage : data.i18n.AllImportedPMIs.replace( '{0}', pmiNameList );
        } else {
            var PartiallyImportedPMIsImportBalloons = data.i18n.PartiallyImportedPMIsImportBalloons.replace( '{0}', pmiNameList );
            PartiallyImportedPMIsImportBalloons = PartiallyImportedPMIsImportBalloons.replace( '{0}', pmiNameList );
            PartiallyImportedPMIsImportBalloons = PartiallyImportedPMIsImportBalloons.replace( '{1}', failedBalloonIds );
            message = isRunInBackground !== undefined ? PartiallyImportedPMIsImportBalloons : data.i18n.PartiallyImportedPMIs.replace( '{0}', pmiNameList );
        }
        //messagingSvc.showInfo(message);
    } else {
        message = isRunInBackground !== undefined && failedBalloonIds && failedBalloonIds.length > 1 ? data.i18n.FailedToImportPMIsImportBalloons.replace( '{0}', failedBalloonIds ) : data.i18n
            .FailedToImportPMIImportBalloons.replace( '{0}', failedBalloonIds );
        message = isRunInBackground === undefined ? data.i18n.FailedToImportPMIs : message;
    }
    messagingSvc.showInfo( message );
    // To refresh the Ballooning tab contents
    appCtxService.updateCtx( 'isImportedPMIS', true );
    return pmiNameList;
};

/*
 * @param {Object} ctx context view model
 * @param {object} data object for read required information
 * @param {string} inspViewMode object for read required information
 */
export let setRefPartsViewMode = function( i18nData, partToInspspectView ) {
    appCtxService.updateCtx( 'refPartListView', false );
    appCtxService.updateCtx( 'refPartTableView', false );
    switch ( partToInspspectView ) {
        case i18nData.Acp0RefPartsListViewTitle:
            appCtxService.updateCtx( 'refPartListView', true );
            break;
        case i18nData.Acp0RefPartsTableViewTitle:
            appCtxService.updateCtx( 'refPartTableView', true );
            break;
        default:
            appCtxService.updateCtx( 'refPartListView', true );
    }
};

/*
 * To manage the visibility of "Part To Inspect" section in ballooning tab
 * @param {dataProviders} data object for read required information
 */
export let showHidePartsListPanel = function( dataProviders ) {
    let ctx = appCtxService.ctx;
    appCtxService.updateCtx( 'showReferencePartList', !ctx.showReferencePartList );
    appCtxService.updateCtx( 'selectedPart', undefined );
    var bctInspViewForDrawing = document.getElementById( 'bctInspViewIdForDrawing' );
    bctInspViewForDrawing.style.setProperty( 'display', 'none' );
    var bctDrawingFrameID = document.getElementById( 'bctDrawingFrameID' );
    bctDrawingFrameID.style.setProperty( 'display', 'none' );
    if( ctx.showComparePartRevisionsList ) {
        //Reset the impacted values based on switchig the panels
        appCtxService.updateCtx( 'showComparePartRevisionsList', false );
        appCtxService.updateCtx( 'baseRevisionSelection', undefined );
        appCtxService.updateCtx( 'baseSelectedPart', undefined );
    }
    if( dataProviders ) {
        dataProviders.partListProvider.selectNone();
        dataProviders.refPartsProvider.selectNone();
        dataProviders.partRevisionListProvider.selectNone();
    }
    if( appCtxService.getCtx( 'showReferencePartList' ) === false ) {
        eventBus.publish( 'Acp0.callPartListDataProvider' );
    }
};

/**
 * Load the column configuration
 *
 * @param {Object} dataprovider - the data provider
 * @param {Object} data - the data
 * @returns {boolean} promise.
 */
export let loadColumns = function( data, dataprovider ) {
    var colInfos = [];
    if( _mapOfColPropNameAndDisplayNameForRefPart.size === 0 ) {
        _mapOfColPropNameAndDisplayNameForRefPart.set( 'object_name', data.i18n.Acp0ObjectName );
        _mapOfColPropNameAndDisplayNameForRefPart.set( 'item_id', data.i18n.Acp0ItemId );
        _mapOfColPropNameAndDisplayNameForRefPart.set( 'object_desc', data.i18n.Acp0ObjectDesc );
        _mapOfColPropNameAndDisplayNameForRefPart.set( 'object_type', data.i18n.Acp0ItemRevisionType );
    }
    if( _mapOfColPropNameAndDisplayNameForRefPart.size > 0 ) {
        _mapOfColPropNameAndDisplayNameForRefPart.forEach( function( colPropDisplay, colPropName, map ) {
            colInfos.push( _getColumnInfoForRespectivePropColumn( colPropName, colPropDisplay, data ) );
        } );
    }
    dataprovider.columnConfig = {
        columns: colInfos
    };

    var deferred = AwPromiseService.instance.defer();

    deferred.resolve( {
        columnInfos: colInfos
    } );
    return deferred.promise;
};

/*
  This function is to highlight all imported balloons while rendering drawing
*/
export let highlightImportedBalloons = async function( data, subPanelContext, eventData ) {
    var inspDefs = [];
    var allChilds = [];
    var propsToLoad = [ 'aqc0PMICharacteristicsUid', 'Aqc0LinkToPartReference' ];
    //To manage the dataprovider selection after import PMI's
    if( appCtxService.ctx.isImportedPMIS && data.dataProviders ) {
        //To update default values on refresh
        appCtxService.updateCtx( 'showReferencePartList', true );
        appCtxService.updateCtx( 'showComparePartRevisionsList', false );
        appCtxService.updateCtx( 'isImportedPMIS', false );
        //To Update selection on refresh
        data.dataProviders.partListProvider.selectNone();
        data.dataProviders.refPartsProvider.selectNone();
        data.dataProviders.partRevisionListProvider.selectNone();
        //To load the latest reference part list on refresh
        eventBus.publish( 'Acp0.getReferencedPartAfterPMIsImported' );
    }
    //Update values to default for refresh Balloon tab
    appCtxService.updateCtx( 'bctInspSelection', undefined );
    appCtxService.updateCtx( 'allSelectedBalloons', undefined );
    appCtxService.updateCtx( 'charUidOfImpPMI', undefined );
    appCtxService.updateCtx( 'renderingErrorMessage', undefined );
    appCtxService.updateCtx( 'selectedPart', undefined );
    appCtxService.updateCtx( 'projectToRenderBctComponent', undefined );
    appCtxService.updateCtx( 'selectedSheet', undefined );
    appCtxService.updateCtx( 'fileTypeOfProject', undefined );
    appCtxService.updateCtx( 'isSelectAllBalloonActive', undefined );
    appCtxService.updateCtx( 'selectedPart', undefined );
    appCtxService.updateCtx( 'isHideAllBalloonActive', undefined );
    var bctInspViewForDrawing = document.getElementById( 'bctInspViewIdForDrawing' );
    bctInspViewForDrawing.style.setProperty( 'display', 'none' );
    var bctDrawingFrameID = document.getElementById( 'bctDrawingFrameID' );
    bctDrawingFrameID.style.setProperty( 'display', 'none' );

    if( eventData && eventData.selectedUids && eventData.selectedUids.length > 0 ) {
        var selectedContext = subPanelContext.selected;
        //// condition is updated to enable rendering of ballooning frame for all subtypes of item revision
        if( subPanelContext.selected.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
            selectedContext = subPanelContext.pselected;
        }
        var vmObj = viewModelObjectService.createViewModelObject( selectedContext.props.awb0UnderlyingObject.dbValues[ 0 ] );
        var input = {
            inputData: {
                product: {
                    type: vmObj.type,
                    uid: vmObj.uid
                },
                requestPref: {
                    firstLevelOnly: [ 'false' ]
                }
            }
        };
        soaSvc.post( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', input ).then( function( response ) {
            if( response.parentChildrenInfos[ 0 ].childrenInfo &&
                    response.parentChildrenInfos[ 0 ].childrenInfo.length > 0 ) {
                for( var i = 0; i < response.parentChildrenInfos[ 0 ].childrenInfo.length; i++ ) {
                    var child = response.parentChildrenInfos[ 0 ].childrenInfo[ i ].occurrence;
                    allChilds.push( response.parentChildrenInfos[ 0 ].childrenInfo[ i ].occurrence );
                }
                for( var i = 0; i < allChilds.length; i++ ) {
                    var child = allChilds[ i ];
                    // We directly want to look for Mci0PMI but getOcuurance3 soa restricts the filtering of Mci0PMI object
                    // So currently we are dealing with insp def object to collect imported PMI char uid.
                    if( child.type === 'Aqc0QcElement' ) {
                        var inspVMO = viewModelObjectService.createViewModelObject( allChilds[ i ].props.awb0UnderlyingObject.dbValues[ 0 ] );
                        propsToLoad = commonUtils._toPreparePropstoLoadData( inspVMO, propsToLoad );
                        inspDefs.push( inspVMO.uid );
                    }
                }
                if( inspDefs.length > 0 && propsToLoad.length > 0 ) {
                    dms.getProperties( inspDefs, propsToLoad ).then( function() {
                        _setCharUIDOfImpPMI( inspDefs, subPanelContext, data, eventData );
                    } );
                } else if( inspDefs.length > 0 && propsToLoad.length === 0 ) {
                    _setCharUIDOfImpPMI( inspDefs, subPanelContext, data, eventData );
                } else {
                    //Prepare and Render the BCT Inspector based on view mode selection.
                    exports.processDrawingRenderingDataBasedOnSelectionChange( data, subPanelContext, '', eventData, [] );
                }
            } else {
                //Prepare and Render the BCT Inspector based on view mode selection.
                exports.processDrawingRenderingDataBasedOnSelectionChange( data, subPanelContext, '', eventData, [] );
            }
        } )
            .catch( function( exception ) {
                logger.error( exception );
            } );
    }
};

/*
 *This Function set the characteristics UID for already Imported PMI
 */
function _setCharUIDOfImpPMI( inspDefs, subPanelContext, data, eventData ) {
    var balloonsTohighlight = [];
    inspDefs.forEach( uid => {
        var inspObj = cdm.getObject( uid );
        //Its regardig segrition of imported PMIs within the revisions
        //var partFromWherePMISImported = inspObj.props.Aqc0LinkToPartReference.dbValues[0];
        //if(partFromWherePMISImported === ctx.selectedPart.uid){
        balloonsTohighlight.push( inspObj.props.aqc0PMICharacteristicsUid.dbValues[ 0 ] );
        //}
    } );
    if( balloonsTohighlight && balloonsTohighlight.length > 0 ) {
        appCtxService.updateCtx( 'charUidsOfImpPMI', balloonsTohighlight );
    }
    //Prepare and Render the BCT Inspector based on view mode selection.
    exports.processDrawingRenderingDataBasedOnSelectionChange( data, subPanelContext, '', eventData, balloonsTohighlight );
}

/*
 *This Function returns the column info for respective column property
 */
function _getColumnInfoForRespectivePropColumn( colPropName, colPropDisplay, data ) {
    return {
        name: colPropName,
        typeName: 'ItemRevision',
        displayName: colPropDisplay,
        maxWidth: 400,
        minWidth: 40,
        width: 120,
        enableColumnMenu: true,
        enableColumnMoving: true,
        enableColumnResizing: true,
        enableSorting: true,
        headerTooltip: true
    };
}

/*
 * To get Referenced part from Inspection definition in PMI Tab
 */
export let getPartFromSearchResultsAndRenderDrawing = function( searchResultsForPartList, data, subPanelContext ) {
    var ctx = appCtxService.ctx;
    ctx.selectedPart = undefined;
    if( searchResultsForPartList[ 0 ] ) {
        var mci0PMIObj = searchResultsForPartList[ 0 ] ? cdm.getObject( searchResultsForPartList[ 0 ].props.awp0Secondary.dbValues[ 0 ] ) : undefined;
        appCtxService.updateCtx( 'selectedPart', cdm.getObject( mci0PMIObj.props.mci0PMIReferencePart.dbValues[ 0 ] ) );
        var eventData = {
            selectedUids: [ appCtxService.getCtx( 'selectedPart' ) ]
        };
        //As part of direct drawing rendering in PMI tab on deselection /cleare selection also drawing should be rendered
        _selectedPartForDirectDrawing = appCtxService.getCtx( 'selectedPart' );
        _charUidsOfImpPMIForDirectDrawing = [ mci0PMIObj.props.mci0PMICharacteristicsUid.dbValues[ 0 ] ];
        //Prepare and Render the BCT Inspector based on view mode selection.
        exports.processDrawingRenderingDataBasedOnSelectionChange( data, subPanelContext, '', eventData, [ mci0PMIObj.props.mci0PMICharacteristicsUid.dbValues[ 0 ] ] );
    }
};

/*
 * Manage visibility of Compare Part Revision Panel.
 */
export let renderAcp0ComparePartRevisionsPanel = function( dataI18n ) {
    //Check to reduce dataprovider call if the Compare Part revision panel is up and user triggers the command on same panel
    if( !appCtxService.ctx.showComparePartRevisionsList ) {
        appCtxService.updateCtx( 'showComparePartRevisionsList', true );
        appCtxService.updateCtx( 'showReferencePartList', false );
        eventBus.publish( 'Acp0.getPartItemTagFromSelectedPartRev' );
    }
    //Update Base revision Selection change
    appCtxService.updateCtx( 'baseRevisionSelection', appCtxService.ctx.projectToRenderBctComponent );
    appCtxService.updateCtx( 'baseSelectedPart', appCtxService.ctx.selectedPart );
    //Due to async call for getting project data below block is important based on value check
    if( !appCtxService.ctx.baseRevisionSelection && appCtxService.ctx.selectedPart ) {
        //Get Project as an input of inspector view to compare with base selected revision
        acp0BCTInspUtilService.getPartAttachmentProject( appCtxService.ctx.baseSelectedPart.uid, dataI18n ).then( values => {
            appCtxService.updateCtx( 'baseRevisionSelection', values.project );
        } );
    }
};

/*
 * To get the Item tag Uid from selected Part revision(Item Revision)
 */
export let getPartItemTagFromSelectedPartRev = function() {
    var partItemTag = appCtxService.ctx.selectedPart;
    return partItemTag.props.items_tag.dbValues[ 0 ];
};

/*
 * To get the runInBackgroundFlag
 */
export let getRunInBackgroundFlag = function() {
    if( _mprefToDecideSyncAsyncCallValue ) {
        var seletedBalloonCount = appCtxService.getCtx( 'allSelectedBalloons' );
        if( _mprefToDecideSyncAsyncCallValue < seletedBalloonCount.length ) {
            return true;
        }
    }
    return false;
};

export default exports = {
    callBCTServiceToGetReduceIpxml,
    callBCTServiceToGetReduceIpxml_TCVersionBackPortSupport,
    callSOAForimportPMIInControlPlanStruct,
    getContextObject,
    getContextObjectUid,
    getPartCharacteristics,
    getPartFromSearchResultsAndRenderDrawing,
    getPartItemTagFromSelectedPartRev,
    getPMINameList,
    getPreferenceValues,
    getPreferenceValuesForSyncAsyncImportPMI,
    getRunInBackgroundFlag,
    readPrefValueForCreateInputInImportPMIProcess,
    getSupportedTCVersion,
    handleSOAResponse,
    highlightImportedBalloons,
    importPmiInControlPlanStructInput,
    importPmiInControlPlanStructInputForImportBalloons,
    loadColumns,
    processDrawingRenderingDataBasedOnSelectionChange,
    readDefaultPSEViewTypeForPMI,
    renderAcp0ComparePartRevisionsPanel,
    setRefPartsViewMode,
    showHidePartsListPanel
};

/**
 * Since this module can be loaded as a dependent DUI module we need to return an object indicating which service
 * should be injected to provide the API for this module.
 */
export let moduleServiceNameToInject = 'Acp0BCTService';
