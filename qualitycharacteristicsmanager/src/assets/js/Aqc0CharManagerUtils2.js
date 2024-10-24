// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for characteristics manager from quality center foundation module
 *
 * @module js/Aqc0CharManagerUtils2
 */
import appCtxService from 'js/appCtxService';
import tcSessionData from 'js/TcSessionData';
import awSvrVer from 'js/TcAWServerVersion';
import Aqc0CharManagerUtils from 'js/Aqc0CharManagerUtils';
import navigationSvc from 'js/navigationService';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import uwPropertySrv from 'js/uwPropertyService';
import addObjectUtils from 'js/addObjectUtils';
import xrtUtilities from 'js/xrtUtilities';
import Aqc0UtilService from 'js/Aqc0UtilService';
import viewModelObjectService from 'js/viewModelObjectService';

var exports = {};

var VAR_CHAR_TYPE = 'Qc0VariableCharSpec';
var VIS_CHAR_TYPE = 'Qc0VisualCharSpec';
var ATT_CHAR_TYPE = 'Qc0AttributiveCharSpec';
var CHAR_GROUP_TYPE = 'Qc0CharacteristicsGroup';


var queryNameInput = {
    inputCriteria: [ {
        queryNames: [
            '_find_latest_charSpec_from_selected'
        ]
    } ]
};

//get Tc major and minor version
var tcMajor = tcSessionData.getTCMajorVersion();
var tcMinor = tcSessionData.getTCMinorVersion();

//get Aw Server version
var awServerVersion = awSvrVer.baseLine;
awServerVersion = awServerVersion.split( 'x' )[0];

//
/**
   * Gets the characteristic group from location context or from the selection.
   *
   * @return {object} characteristic group object.A null object is returned if no
   * characteristic group is found.
   */
export let getCharacteristicGroupObject = function() {
    let ctx = appCtxService.getCtx();
    if ( ctx.locationContext && ctx.locationContext.modelObject && ctx.locationContext.modelObject.type === 'Qc0CharacteristicsGroup' ) {
        return ctx.locationContext.modelObject;
    } else if ( ctx.selected && ctx.selected.type === CHAR_GROUP_TYPE ) {
        return ctx.selected;
    }
    return null;
};
/**
   * This method is used to get the Classification LOV values for the Create/Save As/Edit char spec panel.
   * @param {Object} response the response of the getLov soa
   * @returns {Object} value the LOV value
   */
export let getClassificationLOVList = function( response ) {
    let isTC13_2OnwardsSupported = appCtxService.getCtx( 'isTC13_2OnwardsSupported' );
    if ( !isTC13_2OnwardsSupported ) {
        return Aqc0CharManagerUtils.getLOVList( response );
    }
    return response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[0],
            propDisplayDescription: obj.propDisplayValues.lov_value_descriptions ? obj.propDisplayValues.lov_value_descriptions[0] : obj.propDisplayValues.lov_values[0],
            propInternalValue: obj.propInternalValues.lov_values[0],
            iconName: obj.propInternalValues.lov_values[0]
        };
    } );
};

/*
  * function to check if server supported for tc132 or above tc13 supported
  */

self.isTc132OrAboveTC13VersionSupported = function() {
    if ( tcMajor > 13 || tcMajor === 13 && tcMinor >= 2 ) {
        return true;
    }
    return false;
};

/*
  * function to check if server supported for aw5.213x or above aw version supported
  */
export let isAw5213xOrAboveVersionSupported = function() {
    if ( awServerVersion >= 'aw5.2.0.13' ) {
        return true;
    }
    return false;
};

/*
  * function to check if server supported for tc131 or above tc13 supported
  */
self.isTc131OrAboveTc13VersionSupported = function() {
    if ( tcMajor > 13 || tcMajor === 13 && tcMinor >= 1 ) {
        return true;
    }
    return false;
};

/**
   * This method is used to check whether visual indicator  is supported or not if yes show below properties from custom panel else fetch it from XRT.
   * @param {Object} data input data object
   **/
export let setTC132VersionSpecificPropTitle = function( data ) {
    let tempqc0Criticality = { ...data.qc0Criticality };
    let tempqc0Context = { ...data.qc0Context };

    if ( appCtxService.getCtx( 'isTC13_2OnwardsSupported' ) ) {
        tempqc0Criticality.propertyDisplayName = data.i18n.ClassificationType;
        tempqc0Context.propertyDisplayName = data.i18n.Type;
    } else {
        tempqc0Criticality.propertyDisplayName = data.i18n.Criticality;
        tempqc0Context.propertyDisplayName = data.i18n.Context;
    }

    return {
        qc0Criticality: tempqc0Criticality,
        qc0Context: tempqc0Context
    };
};

/**
   * This method is used to check whether ok condition/not k condition is supported or not if yes show below properties from custom panel else fetch it from XRT.
   * @param {Object} data input data object
   **/
let setTc131VersionSpecificPropTitle = function( data ) {
    let tempqc0OkDescription = { ...data.qc0OkDescription };
    let tempqc0NokDescription = { ...data.qc0NokDescription };
    if ( self.isTc131OrAboveTc13VersionSupported() ) {
        tempqc0OkDescription.propertyDisplayName = data.i18n.OkCondition;
        tempqc0NokDescription.propertyDisplayName = data.i18n.NotOkCondition;
    } else {
        tempqc0OkDescription.propertyDisplayName = data.i18n.OkDescription;
        tempqc0NokDescription.propertyDisplayName = data.i18n.NotOkDescription;
    }
    return {
        qc0OkDescription: tempqc0OkDescription,
        qc0NokDescription: tempqc0NokDescription
    };
};

/**
   * This method is used to check whether ok condition and visual indicatore supported by aw/tc version.
   * @param {Object} data input data object
   **/
export let getSupportedProperties = function( data ) {
    let tc132Obj;
    let tc131Obj;

    tc132Obj = setTC132VersionSpecificPropTitle( data );
    if ( appCtxService.getCtx( 'charSpecType' ) === ATT_CHAR_TYPE ) {
        tc131Obj = setTc131VersionSpecificPropTitle( data );
    }
    return {
        qc0Criticality: tc132Obj ? tc132Obj.qc0Criticality : '',
        qc0Context: tc132Obj ? tc132Obj.qc0Context : '',
        qc0OkDescription: tc131Obj ? tc131Obj.qc0OkDescription : '',
        qc0NokDescription: tc131Obj ? tc131Obj.qc0NokDescription : ''
    };
};

/**
   * This method is used to update state(only for object name,tolerance type) of parent char spec object.
   * @param {Object} data input data object
   * @param {Object} subPanelContext subPanelContext Object
   **/
export const updateStateData = function( subpanelcontext, data ) {
    if ( data.objectName ) {
        let newData = { ...subpanelcontext.objectName.value };
        newData.objectName = data.objectName;
        subpanelcontext.objectName.update( newData );
    }
    if ( data.qc0ToleranceType ) {
        let newData = { ...subpanelcontext.qc0ToleranceType.value };
        newData.qc0ToleranceType = data.qc0ToleranceType;
        subpanelcontext.qc0ToleranceType.update( newData );
    }
};
/**
  * @param {string} - name - name of queryparameter like - uid
  * @returns {string} - returns query parameter value
  **/
export let getQueryParamValue = function( name ) {
    var browserUrl = window.location.href;
    name = name.replace( /[\[]/, '\\\[' ).replace( /[\]]/, '\\\]' );
    var regexS = '[\\?&]' + name + '=([^&#]*)';
    var regex = new RegExp( regexS );
    var results = regex.exec( browserUrl );
    return results === null ? null : results[1];
};

/*
  **To mantain selection after browser refresh for char group /char spec under characteristic Library in tree mode
  */
export let addQueryParamsToBrowserURL = function() {
    var navigationParam = {};
    if ( appCtxService.ctx.currentTypeSelection ) {
        navigationParam.selectedType = appCtxService.ctx.currentTypeSelection.dbValue;
    }
    var selectedObj = appCtxService.getCtx( 'selected' );
    if ( selectedObj && selectedObj.hasOwnProperty( 'uid' ) ) {
        navigationParam.s_uid = selectedObj.uid;
    }

    if ( navigationParam.hasOwnProperty( 's_uid' ) || navigationParam.hasOwnProperty( 'selectedType' ) ) {
        var action = {
            actionType: 'Navigate',
            navigateTo: '#/showCharacteristicslibrary'
        };
        navigationSvc.navigate( action, navigationParam );
    }
};

/**
   * get s_uid from browser url to set the selection
   * @param {ArrayList} selectionModel selection model of pwa
   */
export let setQueryParams = function( selectionModel ) {
    var pwaSelectionUid = [];
    var url = window.location.href;
    if ( url.indexOf( 's_uid' ) > -1 ) {
        var s_uid = getQueryParamValue( 's_uid' );
        pwaSelectionUid.push( s_uid );
    }
    if ( url.indexOf( 'selectedType' ) > -1 ) {
        var selectedType = getQueryParamValue( 'selectedType' );
        pwaSelectionUid.push( selectedType );
    }
    if ( pwaSelectionUid.length > 0 ) {
        selectionModel.setSelection( pwaSelectionUid );
    }
};

export let findLatestCharVersion = function( subPanelContext, data, name ) {
    var deferred = AwPromiseService.instance.defer();
    let latestCharSpecObj = {};
    let ctx = appCtxService.getCtx();
    //if supported version is > TC13.2, push both the arrays with entry-value pair for release_status_list property on master char spec
    if ( ctx.isTC13_2OnwardsSupported ) {
        var inputData = {
            searchInput: {
                maxToLoad: 50,
                maxToReturn: 50,
                providerName: 'Aqc0QualityBaseProvider',
                searchFilterMap6: {
                    'WorkspaceObject.object_type': [ {
                        searchFilterType: 'StringFilter',
                        stringValue: 'Qc0MasterCharSpec'
                    } ]
                },
                searchCriteria: {
                    objectType: 'Qc0MasterCharSpec',
                    isReleased: 'true',
                    sourceObjectGUID: data.currentCharSpec.uid
                },
                searchSortCriteria: []
            }
        };
        soaSvc.post( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData ).then( function( response ) {
            var values = response.ServiceData.plain.map( function( Objuid ) {
                return response.ServiceData.modelObjects[Objuid];
            } );
            if ( data.currentCharSpec.props.qc0BasedOnId.dbValues[0] !== values[0].props.qc0BasedOnId.dbValues[0] ) {
                data.latestCharSpec = viewModelObjectService.constructViewModelObjectFromModelObject( values[0] );
                latestCharSpecObj.latestCharSpec = data.latestCharSpec;
                Aqc0CharManagerUtils.getXrtViewModelForCharSpec( subPanelContext, latestCharSpecObj.latestCharSpec, true ).then( function( res ) {
                    latestCharSpecObj.latestCharSpecxrtViewModel = res;
                    deferred.resolve( latestCharSpecObj );
                }, function( reason ) {
                    deferred.reject( reason );
                } );
            } else {
                deferred.resolve();
            }
        }, function( reason ) {
            deferred.reject( reason );
        } );
    } else {
        var queryName = queryNameInput;
        var entriesArr = [ data.currentCharSpec.modelType.propertyDescriptorsMap.object_name.displayName,
            data.currentCharSpec.modelType.propertyDescriptorsMap.qc0IsLatest.displayName
        ];
        var valuesArr = [ name, 'true' ];
        soaSvc.post( 'Query-2010-04-SavedQuery', 'findSavedQueries', queryName ).then( function( response ) {
            var inputData = {
                query: { uid: response.savedQueries[0].uid, type: 'ImanQuery' },
                entries: entriesArr,
                values: valuesArr
            };

            soaSvc.post( 'Query-2006-03-SavedQuery', 'executeSavedQuery', inputData ).then( function( response ) {
                // eslint-disable-next-line array-callback-return
                Object.keys( response.ServiceData.modelObjects ).map( function( key ) {
                    if ( response.ServiceData.modelObjects[key].type === VIS_CHAR_TYPE || response.ServiceData.modelObjects[key].type === ATT_CHAR_TYPE ||
                         response.ServiceData.modelObjects[key].type === VAR_CHAR_TYPE ) {
                        data.latestCharSpec = response.ServiceData.modelObjects[key];
                        latestCharSpecObj.latestCharSpec = data.latestCharSpec;
                        Aqc0CharManagerUtils.getXrtViewModelForCharSpec( subPanelContext, latestCharSpecObj.latestCharSpec, true ).then( function( res ) {
                            latestCharSpecObj.latestCharSpecxrtViewModel = res;
                            deferred.resolve( latestCharSpecObj );
                        }, function( reason ) {
                            deferred.reject( reason );
                        } );
                    } else {
                        deferred.resolve();
                    }
                } );
            }, function( reason ) {
                deferred.reject( reason );
            } );
        }, function( reason ) {
            deferred.reject( reason );
        } );
    }
    return deferred.promise;
};

/**
   *set required properties for cration of characteristic
   * @param {Object} context props subpanelcontext
   */
export let getCharSpecificationType = function( context ) {
    let charSpecType;
    let charGroupUid;
    let charGroupObjName;
    let isqc0CharacteristicsType;
    let isObjectType;
    let baseOrPwaSelection;

    if ( context && context.searchState ) {
        baseOrPwaSelection = context.searchState.pwaSelection[0];
        isqc0CharacteristicsType = baseOrPwaSelection.props.qc0CharacteristicsType;
        isObjectType = baseOrPwaSelection.props.object_type;
    } /*else if ( context && context.provider ) {
          baseOrPwaSelection = context.provider.baseSelection;*/
    //As per observation baseSelection moved on context object. Hence replacing current provider.baseselection with baseSelectionn directly
    else if ( context && context.baseSelection ) {
        baseOrPwaSelection = context.baseSelection;
        isqc0CharacteristicsType = baseOrPwaSelection.props.qc0CharacteristicsType;
        isObjectType = baseOrPwaSelection.props.object_type;
    }

    if ( isqc0CharacteristicsType || isObjectType ) {
        charSpecType = isqc0CharacteristicsType ? isqc0CharacteristicsType.dbValue : isObjectType.dbValue;
    }

    if ( baseOrPwaSelection ) {
        charGroupUid = baseOrPwaSelection.uid;
        charGroupObjName = baseOrPwaSelection.type;
    }

    if ( charSpecType === 'Variable' ) {
        charSpecType = VAR_CHAR_TYPE;
    } else if ( charSpecType === 'Attributive' ) {
        charSpecType = ATT_CHAR_TYPE;
    } else if ( charSpecType === 'Visual' ) {
        charSpecType = VIS_CHAR_TYPE;
    }
    charSpecType ? appCtxService.registerCtx( 'charSpecType', charSpecType ) : '';
    charGroupUid ? appCtxService.registerCtx( 'charGroupUid', charGroupUid ) : '';
    charGroupObjName ? appCtxService.registerCtx( 'charGroupObjName', charGroupObjName ) : '';
};
export let getSelectedObjValues = async function( data, fields, props, panelType ) {
    let qc0Criticality = { propInternalValue:props.qc0Criticality.dbValue, propDisplayValue: props.qc0Criticality.uiValue };
    fields.qc0Criticality.setLovVal( { lovEntry:qc0Criticality } );

    let qc0Context = { propInternalValue:props.qc0Context.dbValue, propDisplayValue: props.qc0Context.uiValue };
    fields.qc0Context.setLovVal( { lovEntry:qc0Context } );

    fields.object_desc.update( props.object_desc.dbValue ? props.object_desc.dbValue : '' );

    fields.objectName.update( props.object_name.dbValue );
    let GroupList = await Aqc0UtilService.getGroupList( undefined, data.GroupList,data.dataProviders.groupListDataProvider );
    let GroupListDefaultVal = { propInternalValue:GroupList.GroupList.dbValue, propDisplayValue:GroupList.GroupList.uiValue };
    fields.GroupList.setLovVal( { lovEntry:GroupListDefaultVal } );

    let charSpecType = appCtxService.getCtx( 'charSpecType' );

    if ( charSpecType === VAR_CHAR_TYPE ) {
        let qc0UnitOfMeasure = { propInternalValue:props.qc0UnitOfMeasure.dbValue, propDisplayValue: props.qc0UnitOfMeasure.uiValue };
        fields.qc0UnitOfMeasure.setLovVal( { lovEntry:qc0UnitOfMeasure } );

        let qc0limitation = { propInternalValue:props.qc0limitation.dbValue, propDisplayValue: props.qc0limitation.uiValue };
        fields.qc0limitation.setLovVal( { lovEntry:qc0limitation } );

        let qc0ToleranceType = { propInternalValue:props.qc0ToleranceType.dbValue, propDisplayValue: props.qc0ToleranceType.uiValue };
        fields.qc0ToleranceType.setLovVal( { lovEntry:qc0ToleranceType } );

        let qc0UpperTolerance = { propInternalValue:props.qc0UpperTolerance.dbValue, propDisplayValue: props.qc0UpperTolerance.uiValue };
        fields.qc0UpperTolerance.setLovVal( { lovEntry:qc0UpperTolerance } );

        let qc0LowerTolerance = { propInternalValue:props.qc0LowerTolerance.dbValue, propDisplayValue: props.qc0LowerTolerance.uiValue };
        fields.qc0LowerTolerance.setLovVal( { lovEntry:qc0LowerTolerance } );

        let qc0NominalValue = { propInternalValue:props.qc0NominalValue.dbValue, propDisplayValue: props.qc0NominalValue.uiValue };
        fields.qc0NominalValue.setLovVal( { lovEntry:qc0NominalValue } );
    } else if ( charSpecType === ATT_CHAR_TYPE ) {
        let qc0OkDescription = { propInternalValue:props.qc0OkDescription.dbValue, propDisplayValue: props.qc0OkDescription.uiValue };
        fields.qc0OkDescription.setLovVal( { lovEntry:qc0OkDescription } );

        let qc0NokDescription = { propInternalValue:props.qc0NokDescription.dbValue, propDisplayValue: props.qc0NokDescription.uiValue };
        fields.qc0NokDescription.setLovVal( { lovEntry:qc0NokDescription } );
    }
};

/**
  * load lovs
  * @param {*} inputData
  * @returns
  */
export let loadlov = function( filterString, inputData ) {
    var deferred = AwPromiseService.instance.defer();
    // SOA call made to get the content
    soaSvc.post( 'Core-2013-05-LOV', 'getInitialLOVValues', { initialData: { lovInput: inputData.lovInput, propertyName: inputData.propertyName } } ).then( function( response ) {
        let responseData = {};
        let listToDropDown;
        if ( inputData.propertyName === 'qc0Criticality' ) {
            listToDropDown = getClassificationLOVList( response );
        } else {
            listToDropDown = Aqc0CharManagerUtils.getLOVList( response );
        }

        if ( filterString && filterString.trim() !== '' ) {
            listToDropDown = listToDropDown.filter( function( listVal ) {
                return listVal.propInternalValue.toLowerCase().indexOf( filterString.toLowerCase() ) !== -1 ||
                     listVal.propDisplayValue.toLowerCase().indexOf( filterString.toLowerCase() ) !== -1;
            } );
            responseData = {
                listToDropDown: listToDropDown

            };
        } else {
            responseData = {
                listToDropDown: listToDropDown
            };
        }
        return deferred.resolve( { responseData: responseData } );
    } );
    return deferred.promise;
};

export let updateXRTProps = function( createType, editHandler ) {
    let updatedProps = [];
    let editableProperties = addObjectUtils.getObjCreateEditableProperties( createType, 'CREATE', [ 'object_name', 'object_desc' ], editHandler );

    let ctx = appCtxService.getCtx();
    if ( ctx.selected.props.object_name ) {
        let object_name = { ...editableProperties.object_name };
        object_name.dbValue = ctx.selected.props.object_name.dbValue;
        object_name.value = ctx.selected.props.object_name.dbValue;
        uwPropertySrv.updateDisplayValues( object_name, [ object_name.dbValue ] );
        updatedProps.push( object_name );
    }
    if ( ctx.selected.props.object_desc ) {
        let object_desc = { ...editableProperties.object_desc };
        object_desc.dbValue = ctx.selected.props.object_desc.dbValue;
        object_desc.value = ctx.selected.props.object_desc.dbValue;
        uwPropertySrv.updateDisplayValues( object_desc, [ object_desc.dbValue ] );
        updatedProps.push( object_desc );
    }
    if ( updatedProps.length > 0 ) {
        xrtUtilities.updateObjectsInDataSource( updatedProps, 'CREATE', createType );
    }
};

export let changeFieldRequired = ( data ) => {
    let objectName = { ...data.getData().objectName };
    objectName.isRequired = true;
    return objectName;
};

export let markFieldsAsRequired = ( data ) => {
    let qc0ToleranceType = { ...data.getData().qc0ToleranceType };
    qc0ToleranceType.isRequired = true;
    qc0ToleranceType.valueUpdated = true;
    return qc0ToleranceType;
};

/**
   * This method is used to update searchState to show search box
   * @param {Object} searchState searchState Object
   * @param {Object} data input data object
**/
export const updateTotalFoundInSearchstate = function( searchState, data ) {
    if( data.totalFound ) {

        const newSearchData = { ...searchState.value };
        newSearchData.totalFound = data.totalFound;
        searchState.update( newSearchData );
    }
};

export default exports = {
    changeFieldRequired,
    markFieldsAsRequired,
    getCharacteristicGroupObject,
    getClassificationLOVList,
    setTC132VersionSpecificPropTitle,
    getSupportedProperties,
    getQueryParamValue,
    isAw5213xOrAboveVersionSupported,
    addQueryParamsToBrowserURL,
    setQueryParams,
    findLatestCharVersion,
    getCharSpecificationType,
    updateStateData,
    updateXRTProps,
    getSelectedObjValues,
    loadlov,
    updateTotalFoundInSearchstate
};

