// Copyright (c) 2022 Siemens

/**
 * @module js/aceEffectivityService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import sharedEffSvc from 'js/sharedEffectivityService';
import dateEffConfigSvc from 'js/dateEffectivityConfigurationService';

var exports = {};

export let updateEndItemWidgetVisibility = function( data, subPanelContext ) {
    var locationContext = appCtxSvc.getCtx( 'locationContext.ActiveWorkspace:SubLocation' );
    if( ( locationContext === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' || locationContext === 'multiBOMManager:ebomContextSublocation' || locationContext === 'multiBOMManager:mbomContextSublocation' )  && ( data.flag.dbValue === 'AUTHOR' || data.flag.dbValue === 'AUTHORREVISION' ) ) {
        sharedEffSvc.loadTopLevelAsEndItem( data, subPanelContext );
    }
};

/**
    * Get initial date effectivity configuration
    *
    * @param {Object} data - data
    */
export let getInitialDateEffectivityConfigurationData = function( data, occContext ) {
    var dateTimeInfo = dateEffConfigSvc.getInitialDateEffectivityConfigurationData( data, occContext );
    return { currentEffectiveDate: dateTimeInfo.currentEffectiveDate, isTimeEnabled: dateTimeInfo.isTimeEnabled, dateTimeFormat: dateTimeInfo.dateTimeFormat };
};

/**
    * Validate Unit values
    * @param {Object} data - data
    * @param {Object} sharedData - sharedData
    * @param {Object} unitRangeText - unitRangeText
    */
export let validateAndUpdateUnitValue = function( data, sharedData, unitRangeText ) {
    var isUnitRangeValid = true;
    var isBadSyntax = false;
    var isPositiveNumber = true;
    var isTooLarge = false;
    var finalFirstNum;

    var unitValue = data.unitRangeText.dbValue;
    if( unitValue ) {
        var clean = unitValue;
        clean = clean.replace( '/\s+/g', '' ); //remove all spaces from the given string

        if( clean !== null && clean !== '' ) {
            var unitInParts = clean.split( ',' );
            var lastValue = -1;
            var i = 0;
            for( i = 0; i < unitInParts.length; i++ ) {
                var units = unitInParts[ i ].split( '-' );

                // if range is given even after UP or SO, lastValue will be NaN
                // pattern like 10-15-20 is invalid
                if( isNaN( lastValue ) ) {
                    isUnitRangeValid = false;
                    break;
                } else if( units.length > 2 ) {
                    isBadSyntax = true;
                    break;
                }

                // CHeck if first number starts with zero.
                var firstNumber = units[ 0 ];

                //var num = Array.from(firstNumber);
                if( units[ 0 ] ) {
                    finalFirstNum = units[ 0 ].trim().replace( /^0+/, '' );
                    if( finalFirstNum === '' ) {
                        finalFirstNum = 0;
                    }
                }

                var isFirstNumberInteger = Number.isInteger( Number( firstNumber ) );

                // check 1st part is number or if it is a negative number
                if( isNaN( units[ 0 ] ) || units[ 0 ] === '' || !isFirstNumberInteger || _.endsWith( units[0], '.' ) ) {
                    isPositiveNumber = false;
                    break;
                } else if( Number( units[ 0 ] ) <= lastValue ) {
                    isUnitRangeValid = false;
                    break;
                } else if( parseInt( units[ 0 ] ) > 2147483647 ) {
                    isTooLarge = true;
                    break;
                }

                lastValue = Number( units[ 0 ] ); // update last value


                // if there is second part
                if( units.length > 1 ) {
                    // check 2nd part is float
                    var secondNumber = units[ 1 ];
                    var isSecondNumberInteger = Number.isInteger( Number( secondNumber ) );

                    // check 1st part is number
                    if( isNaN( units[ 1 ] ) ) {
                        if( units[ 1 ] !== 'UP' && units[ 1 ] !== 'SO' ) {
                            isPositiveNumber = false;
                            break;
                        }
                    } else if( !isSecondNumberInteger || _.endsWith( units[1], '.' ) ) {
                        isPositiveNumber = false;
                        break;
                    } else if( Number( units[ 1 ] ) <= lastValue ) {
                        isUnitRangeValid = false;
                        break;
                    } else if( parseInt( units[ 1 ] ) > 2147483647 ) {
                        isTooLarge = true;
                        break;
                    }

                    //check if it contains leading 0
                    let newUnitValPart1 = secondNumber.replace( /\b0+/g, '' );

                    lastValue = Number( newUnitValPart1 );
                }
            }
        }
        if( !_.includes( unitValue, '-' ) && finalFirstNum === 0 ) {
            isPositiveNumber = false;
        }
    }
    var modifiedUnitRangeText = updateModifiedUnitRangeText( unitValue, sharedData, unitRangeText );
    return {
        isUnitRangeValid : isUnitRangeValid,
        isBadSyntax : isBadSyntax,
        isPositiveNumber : isPositiveNumber,
        isTooLarge : isTooLarge,
        modifiedUnitRangeText : modifiedUnitRangeText
    };
};

/**
* Validate and update Unit values
* @param {Object} unitValue - unitValue
* @param {Object} subPanelContext - subPanelContext
* @param {Object} unitRangeText - unitRangeText
*/
var updateModifiedUnitRangeText = function( unitValue, sharedData, unitRangeText ) {
    let sharedDataValue = { ...sharedData.value };
    let modifiedUnitRangeText;

    //After returning from endItem panel, unitValue will be null as panel re-renders,
    //but if user had entered some value in unit box before going to end item panel than that value will be stored on subPanelContext.
    if( unitValue === null ) {
        modifiedUnitRangeText = sharedDataValue.unitRangeText.dbValue;
    } else {
        modifiedUnitRangeText = unitValue;
    }

    // if unit value starts with 0 then this code will remove leading 0's. this will be removed for single unit value and not unit range.
    if( unitValue !== null && unitValue.length > 1 && ( !_.includes( unitValue, '-' ) && _.includes( unitValue, 0 ) ) ) {
        modifiedUnitRangeText = unitValue.replace( /\b0+/g, '' );
    }

    // First time when panel is launched, "property required" error is displayed on the screen, so "isUnitUpdated" is maintained.
    // "isUnitUpdated" will become true only when user enters some value in unit box.
    if( unitValue === null && sharedDataValue.unitRangeText.dbValue !== null ) {
        sharedDataValue.isUnitUpdated.dbValue = true;
    }

    sharedData.update( { ...sharedDataValue } );
    if( sharedDataValue.isUnitUpdated.dbValue === true || sharedDataValue.isUnitUpdated.dbValue === 'true' ) {
        unitRangeText.update( modifiedUnitRangeText, {}, { markModified : true } );
    }

    return modifiedUnitRangeText;
};

export const setActiveView = ( destinationPanelId, data, subPanelContext, i18n ) => {
    let sharedData = data.sharedData;
    sharedData = clearFields( sharedData, subPanelContext, i18n, data );
    sharedData.isProtected.dbValue = false;
    sharedData.previousView = sharedData.activeView;
    sharedData.activeView = destinationPanelId;
    return sharedData;
};

export const setActiveViewFromEndItem = ( destinationPanelId, sharedData ) => {
    sharedData.previousView = sharedData.activeView;
    sharedData.activeView = destinationPanelId;
    return sharedData;
};

export let updateRadioBtnValueOnState = ( subPanelContext ) => {
    let sharedData = { ...subPanelContext.value };
    var value = sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue;
    if( value ) {
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = false;
    } else {
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = true;
    }
    subPanelContext.update( { ...sharedData } );
    return sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue;
};

export var clearUnitEffectivityFields = function( data, subPanelContext ) {
    if( subPanelContext.sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue ) {
        let sharedData = subPanelContext.sharedData;
        let sharedDataValue = { ...sharedData.getValue() };
        sharedDataValue.nameBoxForUnit.dbValue = null;
        sharedDataValue.unitRangeText.dbValue = null;
        sharedDataValue.isSharedForUnit.dbValue = false;
        sharedDataValue.isUnitUpdated.dbValue = false;
        sharedData.update( { ...sharedDataValue } );
        updateEndItemWidgetVisibility( data, subPanelContext );
    }
};

export let updateRadioBtnValueToDefault = ( subPanelContext ) => {
    let sharedData = { ...subPanelContext.getValue() };
    sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = true;
    subPanelContext.update( { ...sharedData } );
};


let clearFields = function( sharedDataValue, subPanelContext, i18n, data ) {
    //clear unit effectivity fields
    sharedDataValue.nameBoxForUnit.dbValue = null;
    sharedDataValue.unitRangeText.dbValue = null;
    sharedDataValue.isSharedForUnit.dbValue = false;
    sharedDataValue.isUnitUpdated.dbValue = false;
    if( !subPanelContext.occContext ) {
        sharedDataValue.endItemVal.dbValue = null;
        sharedDataValue.endItemVal.uiValue = null;
    }
    if( subPanelContext.occContext && ( data !== undefined && data.flag && data.flag.dbValue ) ) {
        updateEndItemWidgetVisibility( data, subPanelContext );
    }
    //clear date effectivity fields
    sharedDataValue.isShared.dbValue = false;
    sharedDataValue.nameBox.dbValue = null;
    sharedDataValue.startDate.dbValue = null;
    sharedDataValue.endDate.dbValue = null;
    sharedDataValue.endDateOptions.dbValue = 'Date';
    sharedDataValue.endDateOptions.uiValue = i18n.dateEffectivity;
    sharedDataValue.endItemValForDate.dbValue = null;
    sharedDataValue.endItemValForDate.uiValue = null;
    sharedDataValue.endItemValForDate.endItem.uid = null;
    sharedDataValue.endItemValForDate.endItem.type = null;
    return sharedDataValue;
};

export let clearAllEffectivityFields = ( subPanelContext, i18n, data ) => {
    let sharedData = subPanelContext.sharedData;
    let sharedDataValue = { ...sharedData.getValue() };
    let sharedDataValuesNew = clearFields( sharedDataValue, subPanelContext, i18n, data );

    sharedDataValuesNew.isProtected.dbValue = false;
    sharedData.update( { ...sharedDataValuesNew } );
};

export let clearEffectivityFieldsWithoutProtect = ( subPanelContext, i18n, data ) => {
    let sharedData = subPanelContext.sharedData;
    let sharedDataValue = { ...sharedData.getValue() };
    let sharedDataValuesNew = clearFields( sharedDataValue, subPanelContext, i18n, data );

    sharedData.update( { ...sharedDataValuesNew } );
};

export let updateNameBox = ( fields, fieldName, data ) => {
    let nameBoxUpdated = {};
    nameBoxUpdated = { ...data.nameBox };
    let checkBoxVal = fields.isShared.value;

    if( checkBoxVal === true ) {
        nameBoxUpdated.isRequired = true;
        data.dispatch( { path: 'data.nameBox', value: nameBoxUpdated } );
    } else {
        nameBoxUpdated.isRequired = false;
        data.dispatch( { path: 'data.nameBox', value: nameBoxUpdated } );
    }
};

export let updateNameBoxForUnit = ( fields, fieldName, data ) => {
    let nameBoxUpdated = {};
    nameBoxUpdated = { ...data.nameBoxForUnit };
    let checkBoxVal = fields.isSharedForUnit.value;

    if( checkBoxVal === true ) {
        nameBoxUpdated.isRequired = true;
        data.dispatch( { path: 'data.nameBoxForUnit', value: nameBoxUpdated } );
    } else {
        nameBoxUpdated.isRequired = false;
        data.dispatch( { path: 'data.nameBoxForUnit', value: nameBoxUpdated } );
    }
};

export let updateDateWidgetType = ( subPanelContext, data )=> {
    let sharedData = subPanelContext.sharedData;
    let sharedDataValue = { ...sharedData.getValue() };
    if( data.isTimeEnabled ) {
        sharedDataValue.endDate.type = 'DATETIME';
        sharedDataValue.isTimeEnabled.value = true;
    } else{
        sharedDataValue.endDate.type = 'DATE';
        sharedDataValue.isTimeEnabled.value = false;
    }
    sharedData.update( { ...sharedDataValue } );
};

export let updateProtectCheckBoxOnData = ( sharedData, data ) => {
    let protectedValue = { ...data.isProtected };
    protectedValue.dbValue = sharedData.isProtected.dbValue;
    return protectedValue.dbValue;
};

export let updateViewAndCloseEndItemPanel = ( sharedData ) => {
    let sharedDataValue = { ...sharedData.getValue() };
    let previousView = sharedDataValue.previousView;
    if( sharedDataValue.isDateOrUnitEff === true ) {
        sharedDataValue.previousView = 'AuthorEffectivityEndItemPanelDate';
    } else {
        sharedDataValue.previousView = 'AuthorEffectivityEndItemPanel';
    }
    sharedDataValue.activeView = previousView;
    sharedData.update( { ...sharedDataValue } );
};

export default exports = {
    updateEndItemWidgetVisibility,
    getInitialDateEffectivityConfigurationData,
    validateAndUpdateUnitValue,
    setActiveView,
    updateRadioBtnValueOnState,
    updateNameBox,
    updateNameBoxForUnit,
    updateDateWidgetType,
    clearUnitEffectivityFields,
    updateProtectCheckBoxOnData,
    updateViewAndCloseEndItemPanel,
    clearAllEffectivityFields,
    clearEffectivityFieldsWithoutProtect,
    setActiveViewFromEndItem,
    updateRadioBtnValueToDefault
};
