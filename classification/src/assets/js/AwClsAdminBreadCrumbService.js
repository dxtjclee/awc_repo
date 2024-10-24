// Copyright (c) 2022 Siemens

/**
 * This is tree component to display classification admin object
 *
 * @module js/AwClsAdminBreadCrumbService
 */
import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import classifyAdminConstants from 'js/classifyAdminConstants';
import localeSvc from 'js/localeService';

var exports = {};


var _classSystemBasic;
var _classSystemAdvanced;

var loadConfiguration = function() {
    localeSvc.getTextPromise( 'ClassificationAdminMessages', true ).then( function( localTextBundle ) {
        _classSystemBasic = localTextBundle.basic;
        _classSystemAdvanced = localTextBundle.advanced;
    } );
};

loadConfiguration();

/**
 * buildTitle
 * @function buildTitle
 *
 * @param {Object} searchState search state
 * @param {String} context location context
 * @return {Promise} Promise containing the localized text
 */
export let buildTitle = function( searchState, context ) {
    //No breadcrumb for dashboard
    if ( context === classifyAdminConstants.DASHBOARD ) {
        return '';
    }
    if( searchState ) {
        if( searchState.totalFound > 0 ) {
            //return resultsFound text
            return localeService.getLocalizedTextFromKey( 'ClassificationAdminMessages.resultsCountLabel' ).then( ( localizedText ) => {
                return localizedText.format( searchState.totalFound, searchState.searchString );
            } );
        }
        // return default text
        return localeService.getLocalizedTextFromKey( 'ClassificationAdminMessages.noSearchResultsFound' ).then( ( localizedText ) => {
            return localizedText.format( searchState.searchString );
        } );
    }
    return '';
};

/**
 * Following method updates the class system box with the correct information based on toggle persistence.
 * @param {String} classSystem  the class system that was switched to.
 * @param {ViewModelProperty} systemBoxData  the box to update.
 * @param {String} contents  the i18n string that should display on the box.
 * @return {ViewModelProperty} updated system dropdown box information for UI.
 */
export let initializeSystemBox = function( classSystem, systemBoxData, contents ) {
    //Refactor this whole function.
    if( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC && systemBoxData ) {
        //Update
        systemBoxData.value = classifyAdminConstants.CLASS_SYSTEM_BASIC;
        systemBoxData.uiValue = _classSystemBasic;
        return systemBoxData;
    }
    systemBoxData.uiValue = contents;
    systemBoxData.value = classifyAdminConstants.CLASS_SYSTEM_ADVANCED;
    return systemBoxData;
};

/**
  * Following method reads in the user's selected class system into the search state.
  * @param {String} classSystem  the class system that was switched to.
  * @param {Object} clsAdminCtx  admin context
  */
export let updateClassificationSystem = function( classSystem, clsAdminCtx ) {
    //get class system
    var tempVal = classSystem.dbValue;
    if( !clsAdminCtx ) {
        if ( classSystem === '' ) {
            classSystem = classifyAdminConstants.CLASS_SYSTEM_ADVANCED;
        }
        appCtxService.registerCtx( 'clsAdmin', { classSystem: tempVal } );
    } else {
        if( clsAdminCtx.classSystem !== '' && tempVal &&  tempVal !== '' && tempVal !== clsAdminCtx.classSystem  ) {
            clsAdminCtx.classSystem = tempVal;
            appCtxService.updateCtx( 'clsAdmin', clsAdminCtx );
        }
    }
};

export default exports = {
    buildTitle,
    initializeSystemBox,
    updateClassificationSystem
};
