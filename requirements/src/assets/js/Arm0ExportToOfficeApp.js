//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Module for the Export to Office panel
 *
 * @module js/Arm0ExportToOfficeApp
 */
import _ from 'lodash';
import uwPropertySvc from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import listBoxService from 'js/listBoxService';
import appCtxService from 'js/appCtxService';
import openInVisProductContextInfoProvider from 'js/openInVisualizationProductContextInfoProvider';

var allColumns = {};
var selectedColumns = {};
let selectedResultsText = '';
/**
   * Given an array of Strings to be represented in listbox, this function returns an array of ListModel objects for
   * consumption by the listbox widget.
   *
   * @param {ObjectArray} strings - The Strings array
   * @return {ObjectArray} - Array of ListModel objects.
   */
export let createListModelObjectsFromStrings = function( strings ) {
    var listModels = [];
    for ( var i in strings ) {
        if ( i ) {
            var listModel = _getEmptyListModel();
            var splits = strings[i].split( ',' );

            listModel.propDisplayValue = splits[0];
            listModel.propInternalValue = splits[1];
            listModels.push( listModel );
        }
    }
    return listModels;
};
/**
   * Return an empty ListModel object.
   *
   * @return {Object} - Empty ListModel object.
   */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};
const updateSharedDataState = function( state, newValue ) {
    let stateValue = { ...state.value };
    stateValue = Object.assign( stateValue, newValue );
    state.update( stateValue );
};
const processExportTemplate = function( response, data, ctx, sharedData ) {
    const specEleRevSubTypesListIn = _.get( response, 'outTmplNames.SpecElementRevisionSubTypes' );
    const specEleRevSubTypesList = createListModelObjectsFromStrings( specEleRevSubTypesListIn );
    if( sharedData ) {
        const sharedDataValue = { ...sharedData.value };
        sharedDataValue.specEleRevSubTypesList = specEleRevSubTypesList;
        sharedData.update( sharedDataValue );
    }
    return {

    };
};
/**
   * Update specTemplates, excelTemplates, activity list
   *
   * @param {Object} response SOA response
   * @param {Object} data The panel's view model object
   * @param {Object} ctx AppCtx
   * @param {Object} sharedData shared data state
   * @returns {Object} return data
   */
const processExportTemplatesResponse = function( response, data, ctx, sharedData ) {
    const specTemplatesListIn = _.get( response, 'outTmplNames.SpecTemplate' );
    const excelTemplatesListIn = _.get( response, 'outTmplNames.ExcelTemplate' );
    const objectTemplateListIn = _.get( response, 'outTmplNames.ObjectTemplate' );
    const specEleRevSubTypesListIn = _.get( response, 'outTmplNames.SpecElementRevisionSubTypes' );

    let specTemplatesList = [];
    let excelTemplatesList = [];
    if ( specTemplatesListIn && specTemplatesListIn.length > 0 ) {
        specTemplatesList = listBoxService.createListModelObjectsFromStrings( specTemplatesListIn );
        data.specTemplates.dbValue = specTemplatesList[0].propInternalValue;
    }
    if( ctx && ctx.excelTemplateForExport ) {
        let defaultTemplate = ctx.excelTemplateForExport.parameterTemplate;
        let allExcelTemplatesList = listBoxService.createListModelObjectsFromStrings( excelTemplatesListIn );
        let exportToExcelTemplate;
        for ( const template in allExcelTemplatesList ) {
            if ( allExcelTemplatesList[template].propInternalValue === defaultTemplate ) {
                exportToExcelTemplate = allExcelTemplatesList[template];
                allExcelTemplatesList.splice( template, 1 );
            }
        }
        if( exportToExcelTemplate ) {
            allExcelTemplatesList.unshift( exportToExcelTemplate );
        }
        excelTemplatesList = allExcelTemplatesList;
    } else if ( excelTemplatesListIn && excelTemplatesListIn.length > 0 ) {
        if ( ctx.preferences && ctx.preferences.AWC_REQ_default_excel_template_for_export ) {
            let defaultTemplate = ctx.preferences.AWC_REQ_default_excel_template_for_export[0];

            let allExcelTemplatesList = listBoxService.createListModelObjectsFromStrings( excelTemplatesListIn );
            let exportToExcelTemplate;
            for ( const template in allExcelTemplatesList ) {
                if ( allExcelTemplatesList[template].propInternalValue === defaultTemplate ) {
                    exportToExcelTemplate = allExcelTemplatesList[template];
                    allExcelTemplatesList.splice( template, 1 );
                }
            }
            if( exportToExcelTemplate ) {
                allExcelTemplatesList.unshift( exportToExcelTemplate );
            }
            excelTemplatesList = allExcelTemplatesList;
        } else {
            excelTemplatesList = listBoxService.createListModelObjectsFromStrings( excelTemplatesListIn );
        }
    }

    const objectTemplateList = listBoxService.createListModelObjectsFromStrings( objectTemplateListIn );
    const specEleRevSubTypesList = createListModelObjectsFromStrings( specEleRevSubTypesListIn );

    if( sharedData ) {
        const sharedDataValue = { ...sharedData.value };
        sharedDataValue.objectTemplateList = objectTemplateList;
        sharedDataValue.specEleRevSubTypesList = specEleRevSubTypesList;
        sharedData.update( sharedDataValue );
    }

    return  {
        specTemplatesList: specTemplatesList,
        excelTemplatesList : excelTemplatesList
    };
};
/**
   * Get objects to Export
   *
   * @param {Object} selectedObjects selected objects
   * @return {Any} Array of objects to export
   */
const _getSelectedObjectsType = function( selectedObjects ) {
    let has_item_type = false;
    let has_requirement_type = false;

    let structure_type = 'ITEM_TYPE';

    for( let i = 0; i < selectedObjects.length; i++ ) {
        let obj = selectedObjects[i];

        if ( obj.modelType.typeHierarchyArray.indexOf( 'Arm0RequirementElement' ) > -1 ||
               obj.modelType.typeHierarchyArray.indexOf( 'Arm0ParagraphElement' ) > -1 ||
               obj.modelType.typeHierarchyArray.indexOf( 'Arm0RequirementSpecElement' ) > -1 ||
               obj.modelType.typeHierarchyArray.indexOf( 'SpecElementRevision' ) > -1 ) {
            has_requirement_type = true;
        } else {
            has_item_type = true;
        }
    }

    if ( has_item_type === true && has_requirement_type === true ) {
        structure_type = 'HYBRID';
    } else if ( has_item_type === true ) {
        structure_type = 'ITEM_TYPE';
    } else if ( has_requirement_type === true ) {
        structure_type = 'REQUIREMENT_TYPE';
    }

    return structure_type;
};
/**
   * Update Checkout button state when checkout is enabled
   *
   * @param {Object} occContext ACE Context
   * @param {Object} selectedObjs selected objects
   * @param {Object} implicitCheckOutPref Implicit check-out preference value
   * @returns {Object} checkOutExcel enabled state and its db value
   */
const _checkoutOptionEnabled = function( occContext, selectedObjs, implicitCheckOutPref ) {
    let isEnabled = true;
    let dbValue = false;
    // For ACE Mode
    if ( occContext ) {
        if ( implicitCheckOutPref === 'true' ) {
            dbValue = false;
        } else {
            let structure_type = _getSelectedObjectsType( selectedObjs );
            if ( structure_type === 'HYBRID' || structure_type === 'REQUIREMENT_TYPE' ) {
                dbValue = true;
            } else if ( structure_type === 'ITEM_TYPE' ) {
                dbValue = false;
            }
        }
    } else {
        // Non Ace mode
        if ( implicitCheckOutPref === 'true' ) {
            dbValue = false;
        } else {
            dbValue = true;
        }
    }

    return {
        isEnabled: isEnabled,
        dbValue: dbValue
    };
};
/**
   * Update Checkout button state as per preference value
   *
   * @param {Object} occContext ACE Context
   * @param {Object} selectedObjs selected objects
   * @param {Object} checkOutOptionValue check-out before export preference value
   * @param {Object} implicitCheckOutPref Implicit Check-out preference value
   * @param {Object} showCheckOutOption Show/Hide check-out option
   * @returns {Object} checkOutWord and checkOutExcel enabled state and db value
   */
export let updateCheckoutButtonState = function( occContext, selectedObjs, checkOutOptionValue, implicitCheckOutPref, showCheckOutOption ) {
    //  Word checkOut preference
    let checkOutWord = {};
    if ( checkOutOptionValue === 'default' ) {
        checkOutWord = {
            dbValue: false,
            isEnabled: true
        };
    } else if ( checkOutOptionValue === 'default_hide' ) {
        checkOutWord = {
            dbValue: false,
            isEnabled: false
        };
    } else if ( checkOutOptionValue === 'default_checkout' ) {
        checkOutWord = {
            dbValue: true,
            isEnabled: false
        };
    }

    // Excel checkOut preference
    let checkOutExcel = {};
    if ( showCheckOutOption === 'true' ) {
        checkOutExcel = _checkoutOptionEnabled( occContext, selectedObjs, implicitCheckOutPref );
    } else if ( showCheckOutOption === 'false' ) {
        checkOutExcel = {
            dbValue: false,
            isEnabled: false
        };
    }

    return {
        checkOutWord: checkOutWord,
        checkOutExcel: checkOutExcel
    };
};
/**
   * Add new overrideType to overrideType list.
   *
   * @param {Object} overrideTypes Current List of override types
   * @param {Object} sharedData shared data state
   * @returns {Array} list of override types
   */
export let addOverride = function( overrideTypes, sharedData ) {
    const newOverrideTypes = overrideTypes ? [ ...overrideTypes ] : [];
    const sharedDataValue = { ...sharedData.value };
    let flagAdd = true;

    if ( sharedDataValue.newOverrideType ) {
        for ( const overrideType of newOverrideTypes ) {
            if( overrideType.cellHeader1InVal === sharedDataValue.newOverrideType.cellHeader1InVal &&
                  overrideType.cellHeader2InVal === sharedDataValue.newOverrideType.cellHeader2InVal &&
                  overrideType.cellHeader3InVal === sharedDataValue.newOverrideType.cellHeader3InVal ) {
                flagAdd = false;
                break;
            }
        }
        if( flagAdd ) {
            newOverrideTypes.push( sharedDataValue.newOverrideType );
        }

        delete sharedDataValue.newOverrideType;
        sharedData.update( sharedDataValue );
    }

    return newOverrideTypes;
};
/**
   * Remove given overrideType from overrideType list.
   *
   * @param {Object} overrideTypes override Types
   * @param {Object} sharedData shared data state
   * @returns {Array} override type list
   */
export let removeOverride = function( overrideTypes, sharedData ) {
    const newOverrideTypes = overrideTypes ? [ ...overrideTypes ] : [];
    const sharedDataValue = { ...sharedData.value };

    if ( sharedDataValue.removeOverrideType ) {
        _.pull( newOverrideTypes, sharedDataValue.removeOverrideType );

        delete sharedDataValue.removeOverrideType;
        sharedData.update( sharedDataValue );
    }

    return newOverrideTypes;
};
export let initializeExportTypes = ( exportType ) => {
    let updatedExportTypeProp = _.cloneDeep( exportType );
    let searchExportMaxRows = appCtxService.getCtx( 'preferences.AW_Search_Results_Export_Max_Rows' );
    updatedExportTypeProp.propertyRadioTrueText = searchExportMaxRows[ 0 ];
    updatedExportTypeProp.propertyRadioFalseText = selectedResultsText;
    return updatedExportTypeProp;
};
export let initializeSearchType = ( historyNameToken ) => {
    return historyNameToken;
};
/**
   * Get the selected Spec template name
   *
   * @param {Object} data - The panel's view model object
   * @return {String} The Spec template name
   */
export let getTemplateName = function( data ) {
    var templateName = '';
    if ( !data.exportOption.dbValue ) {
        templateName = data.specTemplates.dbValue; // Word
    } else {
        templateName = data.excelTemplates.dbValue; // Excel
    }

    return templateName;
};
/**
   * Get the selected application format
   *
   * @param {Object} data - The panel's view model object
   * @param {Boolean} toCompare - is export to compare
   * @return {String} The application format
   */
export let getApplicationFormat = function( data, toCompare ) {
    var appFormat = '';
    if ( !data.exportOption.dbValue ) { // Word
        if ( toCompare ) {
            appFormat = 'MSWordCompare';
        } else if ( data.exportWordActivity.dbValue === 'withAttachment' ||
               data.exportWordActivity.dbValue === 'view' ) {
            appFormat = 'MSWordXML';
        } else {
            appFormat = 'MSWordXMLLive';
        }
    } else { // Excel
        if ( data.activity.dbValue === 'view' ) {
            appFormat = 'MSExcel';
        } else if ( data.activity.dbValue === 'liveEdit' ) {
            appFormat = 'MSExcelLive';
        } else if ( data.activity.dbValue === 'bulkliveEdit' ) {
            appFormat = 'MSExcelLiveBulkMode';
        } else if ( data.activity.dbValue === 'editImport' ) {
            appFormat = 'MSExcelReimport';
        }
    }
    return appFormat;
};
/**
   * Get objects to Export
   *
   * @param {Object} data - The panel's view model object
   * @param {Boolean} toCompare - is export to compare
   * @param {Object} selectedObjs selected objects
   * @return {Any} Array of objects to export
   */
export let getObjectsToExport = function( data, toCompare, selectedObjs ) {
    let arrObjects = [];
    // Word compare
    if ( !data.exportOption.dbValue && toCompare ) {
        arrObjects.push( selectedObjs[0] );
    } else {
        // Word or Excel Export
        arrObjects = selectedObjs;
    }

    return arrObjects;
};
/**
   * Get target objects to Export
   *
   * @param {Object} data The panel's view model object
   * @param {Boolean} toCompare is export to compare
   * @param {Object} selectedObjs selected objects
   * @return {Any} Array of target objects to export
   */
export let getTargetObjectsToExport = function( data, toCompare, selectedObjs ) {
    var arrObjects = [];
    var productContextInfo;
    // Word Compare
    if ( !data.exportOption.dbValue && toCompare ) {
        arrObjects.push( selectedObjs[1] );
    } else if ( openInVisProductContextInfoProvider.getProductContextInfo ) {
        // Word or Excel Export with diagram nodes
        productContextInfo = openInVisProductContextInfoProvider.getProductContextInfo();
        if ( productContextInfo && productContextInfo.length > 0 ) {
            arrObjects = productContextInfo[0].selections;
        }
    }
    return arrObjects;
};

/**
   * Get checkout option value
   *
   * @param {Object} data - The panel's view model object
   * @return {Boolean} true if checkout supported
   */
var _getCheckoutOptionValue = function( data ) {
    if ( !data.exportOption.dbValue ) {
        //Word
        if ( data.checkOutWord.dbValue && data.exportWordActivity.dbValue === 'liveEdit' ) {
            return true;
        }
    } else {
        // Excel
        if ( data.checkOutExcel.dbValue &&
               ( data.activity.dbValue === 'liveEdit' || data.activity.dbValue === 'bulkliveEdit' ) ) {
            return true;
        }
    }

    return false;
};

/**
   * Get Run in Background option value
   *
   * @param {Object} data - The panel's view model object
   * @return {Boolean} true if checkout supported
   */
var _getRunInBackgroundOptionValue = function( data ) {
    if ( !data.exportOption.dbValue &&
           ( data.runInBackgroundWord.dbValue || data.exportWordActivity.dbValue === 'withAttachment' ) ) {
        return true;
    }
    if ( data.exportOption.dbValue && data.runInBackgroundExcel.dbValue ) {
        return true;
    }
    return false;
};

/**
   * Get the export options
   *
   * @param {Object} data - The panel's view model object
   * @param {Boolean} toCompare - is export to compare
   * @return {Any} Array of export options
   */
export let getExportOptionValue = function( data, toCompare ) {
    var exportOptions = [];

    if ( toCompare ) {
        return exportOptions;
    }
    var isCheckoutExport = _getCheckoutOptionValue( data );

    if ( isCheckoutExport ) {
        var strOption = {
            option: 'CheckOutObjects',
            optionvalue: 'CheckOutObjects'
        };
        exportOptions.push( strOption );
    }
    var toRunInBackground = _getRunInBackgroundOptionValue( data );
    if ( toRunInBackground ) {
        var strOption1 = {
            option: 'RunInBackground',
            optionvalue: 'RunInBackground'
        };
        exportOptions.push( strOption1 );
    }
    return exportOptions;
};
/**
   * Get the override types
   *
   * @param {Object} data The panel's view model object
   * @param {Boolean} toCompare whether to compare or not
   * @return {Any} Array of export options
   */
export let getOverrideType = function( data, toCompare ) {
    var arrOverrideType = [];
    if ( !data.exportOption.dbValue && !toCompare && data.overrideTypes ) {
        for ( const overrideType of data.overrideTypes ) {
            var objOverrideType = {
                boType: overrideType.cellHeader1InVal,
                objectTemplateName: overrideType.cellHeader2InVal
            };
            arrOverrideType.push( objOverrideType );
        }
    }
    return arrOverrideType;
};
/**
   * Get is include Attachment
   *
   * @param {Object} data The panel's view model object
   * @param {Object} toCompare whether to compare
   * @return {Boolean} is include Attachment
   */
export let getIsIncludeAttachment = function( data, toCompare ) {
    if ( !data.exportOption.dbValue && !toCompare ) {
        if ( data.exportWordActivity.dbValue === 'withAttachment' ) {
            return true;
        }
        return false;
    }
    return false;
};
/** return RunInBackground is set or false.  */
export let getIsRunInBackground = function( data ) {
    var IsRunInBackground = 'false';
    if( data.runInBackgroundExcel.dbValue === true || data.runInBackgroundWord.dbValue === true ) {
        return IsRunInBackground = 'RunInBackground';
    }
    return IsRunInBackground;
};
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    var defaultPageSize = 50;

    if( defaultPageSizePreference ) {
        if( _.isArray( defaultPageSizePreference ) ) {
            defaultPageSize = getDefaultPageSize( defaultPageSizePreference[ 0 ] );
        } else if( _.isString( defaultPageSizePreference ) ) {
            defaultPageSize = parseInt( defaultPageSizePreference );
        } else if( _.isNumber( defaultPageSizePreference ) && defaultPageSizePreference > 0 ) {
            defaultPageSize = defaultPageSizePreference;
        }
    }

    return defaultPageSize;
};

export let getSelectedUids = () => {
    let mselected = appCtxService.getCtx( 'mselected' );
    return _.map( mselected, 'uid' );
};

const getExportWordActivityOptions = function( selectedObjs, options, preferencs ) {
    let validOptions = { ...options };
    if( preferencs === 'true' ) {
        let structure_type = _getSelectedObjectsType( selectedObjs );
        if ( structure_type !== 'REQUIREMENT_TYPE' ) {
            validOptions = [ options[0] ];
        }
        if ( structure_type === 'REQUIREMENT' ) {
            validOptions[1].selected = true;
        }

        return validOptions;
    }
    validOptions = [ options[0], options[2] ];
    return validOptions;
};

const getExportExcelActivityOptions = function( selectedObjs, options, preferences ) {
    let validOptions = { ...options };
    if( preferences === 'true' ) {
        return validOptions;
    }
    validOptions = [ options[0] ];
    return validOptions;
};

const exports = {
    createListModelObjectsFromStrings,
    updateSharedDataState,
    processExportTemplate,
    processExportTemplatesResponse,
    updateCheckoutButtonState,
    addOverride,
    removeOverride,
    initializeExportTypes,
    initializeSearchType,
    getTemplateName,
    getApplicationFormat,
    getObjectsToExport,
    getTargetObjectsToExport,
    getExportOptionValue,
    getOverrideType,
    getIsIncludeAttachment,
    getIsRunInBackground,
    getDefaultPageSize,
    getSelectedUids,
    getExportExcelActivityOptions,
    getExportWordActivityOptions
};
export default exports;

