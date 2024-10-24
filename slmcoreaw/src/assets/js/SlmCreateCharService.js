// Copyright (c) 2022 Siemens

/**
 * Service Plan functions
 *
 * @module js/SlmCreateCharService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import awIconSvc from 'js/awIconService';

var exports = {};

export let charTypeList = function( data ) {
    data.charTypeList = [];
    if( data.searchResults ) {
        var charTypeNames = data.searchResults;
        for( let i = 0; i < charTypeNames.length; i++ ) {
            let dbValue = charTypeNames[ i ].props.type_name.dbValues[ 0 ];
            let uiValue = charTypeNames[ i ].props.type_name.uiValues[ 0 ];

            data.charTypeList.push( {
                incompleteTail: true,
                propDisplayValue: uiValue,
                propInternalValue: dbValue,
                selected: false
            } );
        }
    }
    return data.charTypeList;
};
export const getPart = function() {
    let neutralRevObj = null;
    let folder = null;
    let isFolder = appCtxSvc.getCtx( 'selected.modelType' );
    if ( isFolder.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        folder =  appCtxSvc.getCtx( 'selected' );
        return folder;
    }

    let revUid = appCtxSvc.getCtx( 'selected.props.awb0UnderlyingObject.dbValues[0]' );
    neutralRevObj = cdm.getObject( revUid );

    if ( neutralRevObj.modelType.typeHierarchyArray.indexOf( 'SSP0WorkCardRevision' ) > -1 ) {
        return neutralRevObj;
    }

    if ( neutralRevObj.props.items_tag ) {
        return cdm.getObject( neutralRevObj.props.items_tag.dbValues[0] );
    }
};

export const getCreateRelationsInput = ( data ) =>{
    const primaryObjectPart = getPart();
    const selectedChars = data.dataProviders.charDefListProvider.selectedObjects;
    const relationType = getPasteProp();
    let input = [];
    selectedChars.forEach( ( selectedChar ) => {
        let obj = {
            primaryObject: primaryObjectPart,
            secondaryObject: selectedChar,
            relationType: relationType,
            clientId: ''
        };
        input.push( obj );
    } );
    return input;
};

export const updatePartialErrors = ( Data ) => {
    let localData = Data;
    localData.selectedCount = localData.dataProviders.charDefListProvider.selectedObjects.length;
    if( localData && localData.serviceData && localData.serviceData.partialErrors ) {
        let partialErrs = localData.serviceData.partialErrors;
        let i = 0;
        partialErrs.forEach( ( partialErr ) => {
            partialErr.uid = localData.dataProviders.charDefListProvider.selectedObjects[i].uid;
            i++;
        } );

        localData.charPartialErrors = partialErrs;
    }
    return localData;
};

export let getPasteProp = function() {
    let isFolder = appCtxSvc.getCtx( 'selected.modelType' );
    let revUid = appCtxSvc.getCtx( 'selected.props.awb0UnderlyingObject.dbValues[0]' );
    let RevObj = cdm.getObject( revUid );
    if ( isFolder.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        return 'contents';
    } else if ( RevObj.modelType.typeHierarchyArray.indexOf( 'SSP0WorkCardRevision' ) > -1 ) {
        return 'SSP0CollectsData';
    }

    return 'NeutralCharacteristics';
};


var getBOName = function( data ) {
    if( data.typeOf.dbValue === 'Numeric' ) {
        return 'ObsCharDefinition';
    }
    if( data.typeOf.dbValue === 'Logical' ) {
        return 'Smr0BoolCharDefinition';
    }
    if( data.typeOf.dbValue === 'Textual' ) {
        return 'Smr0StringCharDefinition';
    }
};
export let createdataProviderList = () => {
    var list = [];
    const i18n = require( 'i18n/SlmMessages.json' );

    list.push( createViewModelObject( i18n.dateCharDefinition, '1', 'DateCharDefinition', 'DateCharDefinition' ) );
    list.push( createViewModelObject( i18n.lifeCharDefinition, '2', 'LifeCharDefinition', 'LifeCharDefinition' ) );
    list.push( createViewModelObject( i18n.observationCharDefinition, '3', 'ObsCharDefinition', 'ObsCharDefinition' ) );
    list.push( createViewModelObject( i18n.derivedCharDefinition, '4', 'DerivedCharDefinition', 'DerivedCharDefinition' ) );

    return list;
};
// set properties to VMO
var createViewModelObject = ( name, uid, type, iconType ) => {
    let typeHierarchy = [ iconType ];
    let imageUrl = awIconSvc.getTypeIconFileUrlForTypeHierarchy( typeHierarchy );
    return {
        uid: uid,
        cellHeader1: name,
        type: type,
        typeIconURL: imageUrl,
        props: {
            object_string: name,
            item_id: uid,
            object_name: name
        }
    };
};


var getValues = function( data ) {
    let values = [];
    let charValuesData = {};
    let falseValues = data.falseValues;
    let trueValues = data.trueValues;
    if( data.typeOf.dbValue === 'Textual' ) {
        values = data.stringList.dbValue;
    } else if ( data.typeOf.dbValue === 'Logical' ) {
        charValuesData = { falseValues, trueValues };
        if( data.falseValues.dbValue === '' || data.trueValues.dbValue === '' ) {
            charValuesData.falseValues.dbValue = 'False';
            charValuesData.trueValues.dbValue = 'True';
        }
        values = [ charValuesData.falseValues.dbValue, charValuesData.trueValues.dbValue ];
    }
    return values;
};

export const getCreateCharInput = function( data, selectedObj ) {
    var info = [];
    var isSelectedDateCharPanel = appCtxSvc.getCtx( 'showDateCharPanel' );
    var isSelectedLifeCharPanel = appCtxSvc.getCtx( 'showLifeCharPanel' );
    var isSelectedObsCharPanel = appCtxSvc.getCtx( 'showObsCharPanel' );
    var isSelectedDerivedCharPanel = appCtxSvc.getCtx( 'showDerivedCharPanel' );

    if( isSelectedDateCharPanel ) {
        var name = [ data.charName.dbValue ];
        info.push( {

            clientId: 'one',
            createData: {
                boName: 'DateCharDefinition',
                propertyNameValues: {
                    object_name: name,
                    charUnit: [],
                    charName: name,
                    precision: [ '0' ]
                },
                compoundCreateInput: {}
            },
            dataToBeRelated: {},
            workflowData: {},
            targetObject: getPart(),
            pasteProp: getPasteProp()
        } );
    }

    if( isSelectedLifeCharPanel ) {
        var name = [ data.charName.dbValue ];
        var unit = [ data.charUnit.dbValue ];
        var precision = [
            data.precision.dbValue
        ];
        info.push( {

            clientId: 'one',
            createData: {
                boName: 'LifeCharDefinition',
                propertyNameValues: {
                    object_name: name,
                    charUnit: unit,
                    charName: name,
                    precision: precision
                },
                compoundCreateInput: {}
            },
            dataToBeRelated: {},
            workflowData: {},
            targetObject: getPart(),
            pasteProp: getPasteProp()

        } );
    }
    if( isSelectedObsCharPanel ) {
        var name = [ data.charName.dbValue ];
        var unit = [ data.charUnit.dbValue ];
        var precision = [
            data.precision.dbValue
        ];
        info.push( {

            clientId: 'one',
            createData: {
                boName: getBOName( data ),
                propertyNameValues: {
                    object_name: name,
                    charUnit: unit,
                    charName: name,
                    precision: precision,
                    smr0CharacteristicValues: getValues( data )
                },
                compoundCreateInput: {}
            },
            dataToBeRelated: {},
            workflowData: {},
            targetObject: getPart(),
            pasteProp: getPasteProp()

        } );
    }

    if( isSelectedDerivedCharPanel ) {
        var name = [ data.charName.dbValue ];
        var unit = [ data.charUnit.dbValue ];
        var precision = [ data.precision.dbValue ];
        var expression = [ data.expressionValue.dbValue ];
        var isDerived = [ 'true' ];

        info.push( {

            clientId: 'one',
            createData: {
                boName: getBONameForDerived( data ),
                propertyNameValues: {
                    Smr0derivedExpression: expression,
                    object_name: name,
                    charUnit: unit,
                    charName: name,
                    precision: precision,
                    isDerived: isDerived
                },
                compoundCreateInput: {}
            },
            dataToBeRelated: {},
            workflowData: {},
            targetObject: getPart(),
            pasteProp: getPasteProp()

        } );
    }
    return info;
};

// concat characteristic to expression value
export let prepareCharExpressionValue = ( expressionValueInput, charListBoxInput, existingCharListInput ) => {
    let expressionValue = { ...expressionValueInput };
    let charListBox = { ...charListBoxInput };
    let existingCharList = existingCharListInput;
    if( expressionValue.dbValue === undefined || expressionValue.dbValue === null ) {
        expressionValue.dbValue = '';
    }
    if( charListBox.dbValue !== '' ) {
        for( let characteristic of existingCharList ) {
            let charList = charListBox.dbValue;
            if( charList === characteristic.propDisplayValue ) {
                expressionValue.dbValue += charList + ' ';
                charListBox.dbValue = '';
                charListBox.uiValue = '';
            }
        }
    }
    return { expressionValue, charListBox };
};

// concat operator to expression value
export let prepareOperExpressionValue = ( expressionValueInput, operatorListBoxInput, opratorsListInput ) => {
    let expressionValue = { ...expressionValueInput };
    let operatorListBox = { ...operatorListBoxInput };
    let opratorsList = { ...opratorsListInput };
    if( expressionValue.dbValue === undefined ) {
        expressionValue.dbValue = '';
    }
    if( operatorListBox.dbValue !== '' ) {
        for( let operator of opratorsList.dbValue ) {
            let opList = operatorListBox.dbValue;
            if( opList === operator.dispValue ) {
                expressionValue.dbValue += opList + ' ';
                operatorListBox.dbValue = '';
                operatorListBox.uiValue = '';
            }
        }
    }
    return { expressionValue, operatorListBox };
};

// remove Date, String and boolean characteristics from loaded list
export let filterCharForDerived = response => {
    let listOfChaForDerived = [];
    var loadedList = Object.values( response.ServiceData.modelObjects );
    loadedList.forEach( element => {
        if( element.type === 'LifeCharDefinition' || element.type === 'ObsCharDefinition' ) {
            let propDisplayValue = element.props.object_name.dbValues[ 0 ];
            let propInternalValue = element.props.object_string.dbValues[ 0 ];
            let charType = element.type;
            listOfChaForDerived.push( {
                propDisplayValue: propDisplayValue,
                propInternalValue: propInternalValue,
                charType: charType
            } );
        }
    } );
    return listOfChaForDerived;
};
// @return {String} charType - BOName for charecteristic creation
let getBONameForDerived = data => {
    let charType = 'ObsCharDefinition';
    let loadedCharList = data.existingCharList;
    let exValue = data.expressionValue.dbValue;
    var selectedCharList = exValue.split( /[\s()*+-/]+/ );
    for( let i = 0; i < loadedCharList.length; i++ ) {
        for( let j = 0; j < selectedCharList.length; j++ ) {
            if( selectedCharList[ j ] === loadedCharList[ i ].propDisplayValue && loadedCharList[ i ].charType === 'LifeCharDefinition' ) {
                return loadedCharList[ i ].charType;
            }
        }
    }
    return charType;
};

export const clearData = function( data ) {
    let clearCharData = _.clone( data );
    if( data.charName.dbValue ) {
        clearCharData.charName.dbValue = '';
        clearCharData.charName.dbValues[ 0 ] = null;
    }

    if( data.charUnit.dbValue ) {
        clearCharData.charUnit.dbValue = '';
        clearCharData.charUnit.dbValues[ 0 ] = null;
    }
    if( data.typeOf.dbValue ) {
        clearCharData.typeOf.dbValue = 'Numeric';
        clearCharData.typeOf.dbValues = 'Numeric';
        clearCharData.typeOf.displayValues[ 0 ] = 'Numeric';
        clearCharData.typeOf.dbOriginalValue = 'Numeric';
        clearCharData.typeOf.uiValue = 'Numeric';
    }
    if( data.trueValues.dbValue ) {
        clearCharData.trueValues.dbValue = '';
        clearCharData.trueValues.dbValues[ 0 ] = null;
    }
    if( data.falseValues.dbValue ) {
        clearCharData.falseValues.dbValue = '';
        clearCharData.falseValues.dbValues[ 0 ] = null;
    }
    if( data.precision.dbValue ) {
        clearCharData.precision.dbValue = '';
        clearCharData.precision.dbValues[ 0 ] = null;
    }
    if( data.expressionValue.dbValue ) {
        clearCharData.expressionValue.dbValue = '';
        clearCharData.expressionValue.dbValues[ 0 ] = null;
    }
    return clearCharData;
};
export default exports = {
    createdataProviderList,
    clearData,
    getValues,
    getCreateCharInput,
    getPasteProp,
    getPart,
    filterCharForDerived,
    prepareCharExpressionValue,
    prepareOperExpressionValue,
    getCreateRelationsInput,
    updatePartialErrors
};
