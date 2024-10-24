/* eslint-disable max-lines */
// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Arm0CreateTraceLink
 */
import commandsMapService from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import preferenceService from 'soa/preferenceService';
import ClipboardService from 'js/clipboardService';
import appCtxService from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import addObjectUtils from 'js/addObjectUtils';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import reqUtils from 'js/requirementsUtils';
import reqTracelinkService from 'js/requirementsTracelinkService';
import createTracelinkPopupService from 'js/Arm0CreateTraceLinkPopupService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import awDragAndDropUtils from 'js/awDragAndDropUtils';
import adapterService from 'js/adapterService';
import msgSvc from 'js/messagingService';

var exports = {};
var parentData = {};
var rowTypeMap = {};
var prefValueSoaMap = {};
var primaryObjTypeList = [];
var secondaryObjTypeList = [];
var modelObjectsList = [];
var defaultTraceLinkTypes = [];
var allTracelinkTypes = [];

var TRACELINK_TYPE_RULE_BASED_DISPLAY_VAL = 'Default Type';
var TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL = 'TC_DEFAULT_RULE_BASED_TRACELINK_TYPE';
var UNDERSCORE_CONSTANT = '_';
var PREF_DEFAULT_RELATION_SUFFIX = '_default_relation';
var TRACELINK_TYPE = 'FND_TraceLink'; //NON-NLS-1
var START_ITEM_LIST = 'startItemList';
var END_ITEM_LIST = 'endItemList';

/**
 * Check Is Occurence.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {boolean} true/false
 */
var _isOccurence = function( obj ) {
    if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        return true;
    }
    return false;
};

var _isWorkspceObject = function( obj ) {
    if( commandsMapService.isInstanceOf( 'WorkspaceObject', obj.modelType ) ) {
        return true;
    }
    return false;
};

var _isRunTimeObject = function( obj ) {
    if( commandsMapService.isInstanceOf( 'RuntimeBusinessObject', obj.modelType ) ) {
        return true;
    }
    return false;
};
/**
 * get Revision Object.
 *
 * @param {Object} obj - Awb0Element or revision object
 * @return {Object} Revision Object
 */
var _getRevisionObject = function( obj ) {
    var revObject = null;

    if( _isOccurence( obj ) ) {
        if( obj.props.awb0UnderlyingObject && obj.props.awb0UnderlyingObject.dbValues.length > 0 ) {
            revObject = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }
    } else {
        revObject = cdm.getObject( obj.uid );
    }

    return revObject;
};

/**
 * Check if underlying revision object is same
 *
 * @param {Object} obj1 - firstObject
 * @param {Object} obj2 - second object
 * @returns {Boolean} return true if both are same revision objects
 */
var _hasSameUnderlyingRevision = function( obj1, obj2 ) {
    var modelObj1 = cdm.getObject( obj1.uid );
    var modelObj2 = cdm.getObject( obj2.uid );

    if( modelObj1 && modelObj2 && modelObj1.uid === modelObj2.uid ) {
        return true;
    }
    return false;
};

/**
 * Is Object Exist in Object Array
 *
 * @param {Object} arrObjects - array of objects
 * @param {Object} objToSearch - The object to search
 * @returns {Boolean} is object Exist in data provider list
 */
var _isExistRevObjectInArray = function( arrObjects, objToSearch ) {
    for( var i = 0; i < arrObjects.length; i++ ) {
        if( _hasSameUnderlyingRevision( arrObjects[ i ], objToSearch ) ) {
            return true;
        }
    }
    return false;
};

/**
 * Add in Object List.
 *
 * @param {Any} list1 - first List
 * @param {any} list2 -second list
 */
var _getCommonObjectsCount = function( list1, list2 ) {
    var count = 0;
    for( var i = 0; i <= list2.length - 1; i++ ) {
        if( _isExistRevObjectInArray( list1, list2[ i ] ) ) {
            count += 1;
        }
    }
    return count;
};

/**
 * Check if given objects is same
 *
 * @param {Object} obj1 - firstObject
 * @param {Object} obj2 - second object
 * @returns {Boolean} return true if both are same objects
 */
var _isSameObjects = function( obj1, obj2 ) {
    if( obj1 && obj2 && obj1.uid === obj2.uid ) {
        return true;
    }
    return false;
};

/**
 * Add in Data provide List.
 *
 * @param {Object} dataProvider - The data provider
 * @param {Object} newObj - The new object to be added
 * @returns {Boolean} is object added in data provider list
 */
var _addInDataProvider = function( dataProvider, newObj ) {
    var flagAdd = _isExistRevObjectInArray( dataProvider.dbValue, newObj );

    if( !flagAdd ) {
        var obj = cdm.getObject( newObj.uid );
        dataProvider.dbValue.push( obj );
        modelObjectsList.push( obj );
        return true;
    }
    return false;
};

/**
 * Remove given object from provider list.
 *
 * @param {Object} dataProvider - The view model dataProvider
 * @param {Object} obj - The object to be removed
 * @returns {Boolean} is object removed from data provider list
 */
var _removeFromDataProvider = function( dataProvider, obj ) {
    if( obj ) {
        for( var i = dataProvider.dbValue.length - 1; i >= 0; i-- ) {
            if( _hasSameUnderlyingRevision( dataProvider.dbValue[ i ], obj ) ) {
                dataProvider.dbValue.splice( i, 1 );
                return true;
            }
        }
    }
    return true;
};

/**
 * Get Tracelink preference name with rule.
 *
 * @param {Object} primaryObject - Defining Object
 * @param {Object} secondaryObject - Complying Object
 * @return {String} - Preference name.
 */
var _getTraceLinkPrefNameWithRule = function( primaryObject, secondaryObject ) {
    return primaryObject.type + UNDERSCORE_CONSTANT + secondaryObject.type + PREF_DEFAULT_RELATION_SUFFIX;
};

/**
 * Get Tracelink preference name with reverse rule.
 *
 * @param {Object} primaryObject - Defining Object
 * @param {Object} secondaryObject - Complying Object
 * @return {String} - Preference name.
 */
var _getTraceLinkPrefNameWithReverseRule = function( primaryObject, secondaryObject ) {
    return secondaryObject.type + UNDERSCORE_CONSTANT + primaryObject.type +
        PREF_DEFAULT_RELATION_SUFFIX;
};
/**
 * Get Tracelink Preference names from objects.
 *
 * @param {Object} data - The panel's view model object
 * @return {Any}} - Array of preference names.
 */
var _getTraceLinkPrefsFromObjects = function( data ) {
    var prefNames = [];

    var primaryTypes = [];
    var secondaryTypes = [];

    for( var i = 0; i <= data.startItems.dbValue.length - 1; i++ ) {
        var primaryObject = _getRevisionObject( data.startItems.dbValue[ i ] );
        if( primaryObject ) {
            if( primaryTypes.indexOf( primaryObject.type ) === -1 ) {
                primaryTypes.push( primaryObject.type );
            }
            for( var j = 0; j <= data.endItems.dbValue.length - 1; j++ ) {
                var secondaryObject = _getRevisionObject( data.endItems.dbValue[ j ] );
                if( secondaryObject ) {
                    if( secondaryTypes.indexOf( secondaryObject.type ) === -1 ) {
                        secondaryTypes.push( secondaryObject.type );
                    }

                    var tlRule = _getTraceLinkPrefNameWithRule( primaryObject, secondaryObject );
                    var tlReversRule = _getTraceLinkPrefNameWithReverseRule( primaryObject, secondaryObject );

                    if( prefNames.indexOf( tlRule ) === -1 ) {
                        prefNames.push( tlRule );
                    }

                    if( prefNames.indexOf( tlReversRule ) === -1 ) {
                        prefNames.push( tlReversRule );
                    }
                }
            }
        }
    }

    primaryObjTypeList = primaryTypes;
    secondaryObjTypeList = secondaryTypes;

    return prefNames;
};
/**
 * Set Tracelink Type
 *
 * @param {Object} data - The panel's view model object
 * @param {String} tracelinkType - Tracelink type
 */
var _setTracelinkType = function( data, tracelinkType ) {
    for( var i = 0; i < data.traceLinkTypeList.length; i++ ) {
        if( data.traceLinkTypeList[ i ].propInternalValue === tracelinkType ) {
            data.traceLinkType.dbValue = data.traceLinkTypeList[ i ].propInternalValue;
            data.traceLinkType.uiValue = data.traceLinkTypeList[ i ].propDisplayValue;
            break;
        }
    }
};
/**
 * set Rule Based Trace Link Rule
 *
 * @param {Object} data - The panel's view model object
 */
var _setRuleBasedTracelink = function( data, prefs ) {
    prefValueSoaMap = prefs;

    var prefKeys = Object.keys( prefValueSoaMap );

    if( !prefKeys || prefKeys.length <= 0 ) {
        data.traceLinkTypeList = defaultTraceLinkTypes;
        if( data.selectedTraceLinkType && defaultTraceLinkTypes.some( traceLinkType => traceLinkType.propInternalValue === data.selectedTraceLinkType ) ) {
            data.defaultTraceLinkType = data.selectedTraceLinkType;
        }
        _setTracelinkType( data, data.defaultTraceLinkType );
        return;
    }

    if( primaryObjTypeList.length > 1 || secondaryObjTypeList.length > 1 ) {
        data.traceLinkTypeList = defaultTraceLinkTypes;
        _setTracelinkType( data, TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL );
    } else {
        if( prefKeys && prefKeys.length > 0 ) {
            var prefKey = null;
            let selectedObjectsPrefValue = primaryObjTypeList[0] + UNDERSCORE_CONSTANT + secondaryObjTypeList[0] + PREF_DEFAULT_RELATION_SUFFIX;

            if( prefKeys.includes( selectedObjectsPrefValue ) ) {
                prefKey = selectedObjectsPrefValue;
            }
            if( prefKey !== null ) {
                var prefValue = prefValueSoaMap[ prefKey ];

                var finalList = allTracelinkTypes.filter( ( tl_Type ) => prefValue.includes( tl_Type.propInternalValue ) );
                data.traceLinkTypeList = finalList;

                if( prefValue && prefValue[ 0 ] ) {
                    _setTracelinkType( data, prefValue[ 0 ] );
                }
            } else{
                data.traceLinkTypeList = defaultTraceLinkTypes;
                _setTracelinkType( data, data.defaultTraceLinkType );
            }
        }
    }
};
/**
 * Validate Trace Link Rule
 *
 * @param {Object} data - The panel's view model object
 */
var _validateTraceLinkRule = function( data ) {
    if( data.startItems.dbValue.length > 0 && data.endItems.dbValue.length > 0 ) {
        var prefNames = _getTraceLinkPrefsFromObjects( data );
        preferenceService.getMultiStringValues( prefNames ).then( function( prefs ) {
            _setRuleBasedTracelink( data, prefs );
            if( data.dispatch ) {
                if( !data.selectedTraceLinkType || data.selectedTraceLinkType && data.selectedTraceLinkType !== data.traceLinkType.dbValue ) {
                    data.dispatch( { path: 'data.traceLinkType.dbValue',   value: data.traceLinkType.dbValue } );
                    data.dispatch( { path: 'data.traceLinkType.uiValue',   value: data.traceLinkType.uiValue } );
                    _updateSelectedTraceLinkType( data, data.traceLinkType );
                }
                data.dispatch( { path: 'data.traceLinkTypeList',   value: data.traceLinkTypeList } );
            }
        } );
    }
};

/**
 * Return the type icon url for given type
 *
 * @param {Object} revObject - Model object
 * @returns {Any} icon URL
 */
var _getObjectIconURL = function( revObject ) {
    return reqUtils.getTypeIconURL( revObject.type, revObject.modelType.typeHierarchyArray );
};

var _strEndsWith = function( directionStr, searchValue ) {
    return directionStr.substring( directionStr.length - searchValue.length, directionStr.length ) === searchValue;
};
/**
 * Create and return the tracelinked item from proxy link object
 * @param {Object} linkInfo - tracelink proxy object
 * @returns {Object} cell Item to display in existing tracelink tab
 */
var _getTracelinkedItem = function( linkInfo, data ) {
    if( !linkInfo || !linkInfo.props || !linkInfo.props.awp0RelatedObject ) {
        return null;
    }

    var relatedElement = cdm.getObject( linkInfo.props.awp0RelatedObject.dbValues[ 0 ] );
    relatedElement.props.awp0CellProperties.dbValue = relatedElement.props.awp0CellProperties.dbValues;

    reqTracelinkService.updateCellProperties( relatedElement );
    var cellHeader1 = relatedElement.cellHeader1;
    var cellHeader2 = relatedElement.cellHeader2;
    var elementTypeIcon = '';
    var cellHeader3 = linkInfo.props.awp0RelationTypeName.uiValues[ 0 ];
    if( cellHeader3 === '' ) {
        cellHeader3 = linkInfo.props.awp0RelationTypeName.dbValues[ 0 ];
    }
    var elementType = 'R->R';
    var elementTypeTitle = data.i18n.revisionToRevisionTypeTitle;
    elementTypeIcon = 'indicatorRevToRev';

    var revObject = _getRevisionObject( relatedElement );
    if( revObject ) {
        var objIconURL = _getObjectIconURL( revObject );
        var directionStr = linkInfo.props.awp0Direction.dbValues[ 0 ];
        if( _strEndsWith( directionStr, '-1' ) ) {
            elementType = 'O->O';
            elementTypeTitle = data.i18n.occurrenceToOccurrenceTypeTitle;
            elementTypeIcon = 'indicatorOccToOcc';
        } else if( _strEndsWith( directionStr, '-2' ) ) {
            elementType = 'O->R';
            elementTypeTitle = data.i18n.occurrenceToRevisionTypeTitle;
            elementTypeIcon = 'indicatorOccToRev';
        } else if( _strEndsWith( directionStr, '-3' ) ) {
            elementType = 'R->O';
            elementTypeTitle = data.i18n.revisionToOccurrenceTypeTitle;
            elementTypeIcon = 'indicatorRevToOcc';
        } else if( _strEndsWith( directionStr, '-0' ) ) {
            elementType = 'R->R';
            elementTypeTitle = data.i18n.revisionToRevisionTypeTitle;
            elementTypeIcon = 'indicatorRevToRev';
        }

        if( relatedElement.cellProperties && relatedElement.cellProperties.Revision && elementType !== 'O->O' && elementType !== 'R->O' ) {
            cellHeader2 += '/' + relatedElement.cellProperties.Revision.value;
        }
        var linkIcon = '';
        var tracelinkTitle = '';

        if( _.includes( directionStr, data.i18n.definingTracelinkTitle ) ) {
            linkIcon = 'indicatorArrowNorthEast';
            tracelinkTitle = data.i18n.definingTracelinkTitle;
        } else {
            linkIcon = 'indicatorArrowSouthWest';
            tracelinkTitle = data.i18n.complyingTracelinkTitle;
        }

        return {
            cellHeader1: cellHeader1,
            cellHeader2: cellHeader2,
            cellHeader3: cellHeader3,
            iconURL: objIconURL,
            typeIconURL: objIconURL,
            tracelinkIcon: linkIcon,
            elementTypeIcon: elementTypeIcon,
            tracelinkTitle: tracelinkTitle,
            id: revObject.uid,
            uidProxyTracelink: linkInfo.uid,
            elementType: elementType,
            elementTypeTitle: elementTypeTitle
        };
    }
};

/**
 * Add in Object List.
 *
 * @param {Object} data - The view model data
 * @param {Object} newObjList - objects to be added in End Item list
 */
var _addInObjectList = function( data, destObjectList, otherObjectList, newObjList ) {
    var newObjs = _getTracelinkEligbleObjList( newObjList );
    data.errorManyToManyTracelink = false;
    var countCommon = _getCommonObjectsCount( otherObjectList.dbValue, newObjs );

    if( otherObjectList.dbValue.length - countCommon > 1 && destObjectList.dbValue.length + newObjs.length > 1 ) {
        data.errorManyToManyTracelink = true;
        return false;
    }

    var objectsToLoad = [];
    for( var i = 0; i <= newObjs.length - 1; i++ ) {
        var newObj = _getRevisionObject( newObjs[ i ] );

        // check if revision needs to reload
        // Inside ACE in case of create/delete tracelink, for some use cases occurrences get refreshed but their currsponding revisions needs explicit refresh,
        var occHasTracelinkProp = null;
        if( commandsMapService.isInstanceOf( 'Awb0Element', newObjs[ i ].modelType ) ) {
            occHasTracelinkProp = newObjs[ i ].props.awb0TraceLinkFlag;
        }
        var revHasTracelinkProp = newObj ? newObj.props.has_trace_link : undefined;
        if( occHasTracelinkProp && occHasTracelinkProp.dbValues[ 0 ] === '1' && revHasTracelinkProp && revHasTracelinkProp.dbValues[ 0 ] === '0' ||
            occHasTracelinkProp && occHasTracelinkProp.dbValues[ 0 ] === '0' && revHasTracelinkProp && revHasTracelinkProp.dbValues[ 0 ] === '1' ) {
            objectsToLoad.push( newObj );
        }

        var isExistInOtherList = _isExistRevObjectInArray( otherObjectList.dbValue, newObjs[ i ] );
        if( isExistInOtherList ) {
            // Remove object from second list before adding to Destination list
            _removeFromDataProvider( otherObjectList, newObjs[ i ] );
        }
        _addInDataProvider( destObjectList, newObjs[ i ] );
    }

    // refresh the objects where has_trace_link property value is different for occurrence & revision.
    if( objectsToLoad.length > 0 ) {
        soaSvc.post( 'Core-2007-01-DataManagement', 'refreshObjects', {
            objects: objectsToLoad
        } );
    }

    var propertiesToLoad = [ 'awp0CellProperties', 'object_string' ];
    for( var ii = 0; ii <= newObjs.length - 1; ii++ ) {
        if( _isOccurence( newObjs[ ii ] ) ) {
            propertiesToLoad.push( 'awb0UnderlyingObject' );
            break;
        }
    }

    reqUtils.loadModelObjects( newObjs, propertiesToLoad ).then( function() {
        eventBus.publish( 'CreateTracelink.refreshStartItemList' );
        eventBus.publish( 'CreateTracelink.refreshEndItemList' );
    } );

    _validateTraceLinkRule( parentData );

    return true;
};

/**
 * Remove given object from Start Item List.
 *
 * @param {Object} data - The view model data
 * @param {Object} obj - The Object to be removed from Start Item list
 */
export let removeFromStartItems = function( data, obj ) {
    if( obj ) {
        _removeFromDataProvider( data.startItems, obj );
        _validateTraceLinkRule( parentData );
        createTracelinkPopupService.updateLocalStorageData( data );
    }

    setTimeout( () => {
        eventBus.publish( 'CreateTracelink.refreshStartItemList' );
    }, 50 );
};

/**
 * Remove given object from End Item List.
 *
 * @param {Object} data - The view model data
 * @param {Object} obj - Object to be removed
 */
export let removeFromEndItems = function( data, obj ) {
    if( obj ) {
        _removeFromDataProvider( data.endItems, obj );
        _validateTraceLinkRule( parentData );
        createTracelinkPopupService.updateLocalStorageData( data );
    }

    setTimeout( () => {
        eventBus.publish( 'CreateTracelink.refreshEndItemList' );
    }, 50 );
};

/**
 * Paste In End Item List.
 *
 * @param {Object} data - The view model data
 */
export let pasteInStartItems = function( data ) {
    var clipboardObjects = ClipboardService.instance.getContents();

    if( clipboardObjects && clipboardObjects.length > 0 ) {
        _addInObjectList( data, parentData.startItems, parentData.endItems, clipboardObjects );
        createTracelinkPopupService.updateLocalStorageData( data );
    }
};

/**
 * Paste In End Item List.
 *
 * @param {Object} data - The view model data
 */
export let pasteInEndItems = function( data ) {
    var clipboardObjects = ClipboardService.instance.getContents();

    if( clipboardObjects && clipboardObjects.length > 0 ) {
        _addInObjectList( data, parentData.endItems, parentData.startItems, clipboardObjects );
        createTracelinkPopupService.updateLocalStorageData( data );
    }
};
/**
 * Get object, tracelink can be created on
 *
 * @param {Object} sourceObj - Teamcenter Object
 * @return {Object} input data for trace link creation
 */
var _getTracelinkEligbleObj = function( sourceObj ) {
    if( !_isWorkspceObject( sourceObj ) && !_isOccurence( sourceObj ) &&
        _isRunTimeObject( sourceObj ) ) {
        var srcObjs = adapterService.getAdaptedObjectsSync( [ sourceObj ] );
        if( srcObjs !== null && srcObjs.length > 0 ) {
            return srcObjs[ 0 ];
        }
        return null;
    }
    return sourceObj;
};
/**
 * Get object list, tracelink can be created on
 *
 * @param {Array} objectList - Teamcenter Object list
 * @return {Object} input data for trace link creation
 */
var _getTracelinkEligbleObjList = function( objectList ) {
    var resultObjList = [];
    for( var i = 0; i <= objectList.length - 1; i++ ) {
        var obj = _getTracelinkEligbleObj( objectList[ i ] );
        if( obj ) {
            resultObjList.push( obj );
        }
    }
    return resultObjList;
};
/**
 * Generate json input data for create tracelink
 *
 * @param {Object} primaryObject - Defining Object
 * @param {Object} secondaryObject - Complying Object
 * @param {String} tracelinkType - Tracelink type
 * @param {Any} propNameValues - Properties
 * @return {Object} input data for trace link creation
 */
var _generateInputforCreateTraceLink = function( primaryObject, secondaryObject, tracelinkType, propNameValues ) {
    var isPrimaryOccurence = false;
    var isSecondaryOccurence = false;
    var requestPref = {};

    if( primaryObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        isPrimaryOccurence = true;
    }
    if( secondaryObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        isSecondaryOccurence = true;
    }

    if( isPrimaryOccurence && isSecondaryOccurence ) {
        requestPref.createTracelinkWithOccurrences = 'true';
    } else if( isPrimaryOccurence && !isSecondaryOccurence ) {
        requestPref.createDefiningTracelinkWithOccurrence = 'true';
    } else if( !isPrimaryOccurence && isSecondaryOccurence ) {
        requestPref.createComplyingTracelinkWithOccurrence = 'true';
    }

    return {
        clientId: '',
        tracelinkCreateInput: {
            boName: tracelinkType,
            propertyNameValues: propNameValues,
            compoundCreateInput: {}
        },
        primaryObj: {
            uid: primaryObject.uid,
            type: primaryObject.type
        },
        secondaryObj: {
            uid: secondaryObject.uid,
            type: secondaryObject.type
        },
        requestPref: requestPref
    };
};

/**
 * Get input data for trace link creation
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} primaryObject - Defining Object
 * @param {Object} secondaryObject - Complying Object
 * @param {Object} editHandler - EditHandler Object
 * @return {Object} input data for trace link creation
 */
var _getCreateTraceLinkInput = function( data, primaryObject, secondaryObject, editHandler ) {
    var objInput = {};

    var tracelinkType = '';
    if( data.traceLinkType.dbValue !== TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL ) {
        tracelinkType = data.traceLinkType.dbValue;
    }
    var propNameValues = {};
    let objCreateInfo = addObjectUtils.getObjCreateInfo( data.traceLinkType, editHandler );
    if( objCreateInfo && objCreateInfo.props.length > 0 ) {
        var createInput = addObjectUtils.getCreateInput( data, null, data.selectedTraceLinkType, editHandler );
        var createData = createInput[ 0 ].createData;
        var dataObj = reqTracelinkService.getProperties2( createData.propertyNameValues, objCreateInfo.props );

        propNameValues = dataObj.stringProps;
    }

    objInput = _generateInputforCreateTraceLink( primaryObject, secondaryObject, tracelinkType, propNameValues );
    return objInput;
};

/**
 * Get input data for trace link creation
 *
 * @param {Object} items - start or end item list
 * @return {Object} updated item list
 */
var _processItemList = function( items ) {
    var updatedItems = items.slice( 0 );
    for( var i = 0; i <= updatedItems.length - 1; i++ ) {
        var tracelinkTitle = reqTracelinkService.getToggleType( updatedItems[ i ] );
        if( tracelinkTitle === 'Switch to Occurrence' && updatedItems[ i ].modelType.typeHierarchyArray.includes( 'Awb0Element' ) ) {
            var obj1Rev = _getRevisionObject( updatedItems[ i ] );
            if( obj1Rev ) {
                updatedItems[ i ] = obj1Rev;
            }
        }
    }
    return updatedItems;
};
/**
 * Get input data for trace link creation in ACE
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} editHandler - EditHandler object
 * @return {Any} input data for trace link creation
 */
export let getCreateTraceLinkInput = function( data, editHandler ) {
    var arrInput = [];

    var startItemsRev = _processItemList( data.startItems.dbValue );
    var endItemsRev = _processItemList( data.endItems.dbValue );

    for( var i = 0; i <= startItemsRev.length - 1; i++ ) {
        var primaryObject = startItemsRev[ i ];

        for( var j = 0; j <= endItemsRev.length - 1; j++ ) {
            var secondaryObject = endItemsRev[ j ];

            var objInput = _getCreateTraceLinkInput( data, primaryObject, secondaryObject, editHandler );
            arrInput.push( objInput );
        }
    }
    return arrInput;
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

/**
 * check if object copied from clipboard
 *
 * @param {Object} ctx - Context
 */
var _checkObjectCopiedFromClipboard = function( ctx ) {
    var clipboardObjects = ClipboardService.instance.getContents();
    if( clipboardObjects && clipboardObjects.length > 0 ) {
        let ctxCreateTraceLinkWorkSpace = appCtxService.getCtx( 'createTraceLinkWorkSpace' );
        if( ctxCreateTraceLinkWorkSpace && !ctxCreateTraceLinkWorkSpace.hasObjectsInClipboard ) {
            let createTraceLinkWorkSpace = { ...ctxCreateTraceLinkWorkSpace };
            createTraceLinkWorkSpace.hasObjectsInClipboard = true;
            appCtxService.updateCtx( 'createTraceLinkWorkSpace', createTraceLinkWorkSpace );
        }else{
            let createTraceLinkWorkSpace = {
                hasObjectsInClipboard : true
            };
            appCtxService.registerCtx( 'createTraceLinkWorkSpace', createTraceLinkWorkSpace );
        }
    }
};
/**
 * Init Start Item List Types
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx - Context
 */
export let initStartItemList = function( data, ctx ) {
    reqTracelinkService.resetToggleType();
    ctx.createTraceLinkWorkSpace = {};
    if( parentData.rowProductContextFromMatrix || parentData.isTraceabilityMatrixObject ) {
        data.rowProductContextFromMatrix = parentData.rowProductContextFromMatrix;
        data.srcObjectFromMatrix = parentData.srcObjectFromMatrix;
        data.isTraceabilityMatrixObject = parentData.isTraceabilityMatrixObject;
    }
    parentData = data;
    modelObjectsList = [];
    var viewExistingTracelink = false;
    var sourceObject = [];
    var panelContext = ctx.rmTracelinkPanelContext;

    // Check if source object is passed through the panel context
    if( panelContext && panelContext.sourceObject ) {
        for( var i = 0; i < panelContext.sourceObject.length; i++ ) {
            var obj1 = cdm.getObject( panelContext.sourceObject[ i ].uid );
            obj1 = _getTracelinkEligbleObj( obj1 );
            if( obj1 ) {
                modelObjectsList.push( obj1 );
                sourceObject.push( obj1.uid );
            }
        }
        if( panelContext.viewExistingTracelink ) {
            viewExistingTracelink = true;
        }
    } else {
        // Get selected objects from the app context
        //var objList = JSON.parse( JSON.stringify( ctx.mselected ) );
        var objList = ctx.mselected;
        for( var ob = 0; ob < objList.length; ob++ ) {
            var obj = cdm.getObject( objList[ ob ].uid );
            if( obj ) {
                obj = _getTracelinkEligbleObj( obj );
                if( obj ) {
                    modelObjectsList.push( obj );
                }
            }
        }
    }

    var endObjectsList = [];

    var objectStrFromLocalStorage = createTracelinkPopupService.getLocalStorageData();
    if( objectStrFromLocalStorage ) {
        var objectsFromLocalStorage = JSON.parse( objectStrFromLocalStorage );
        modelObjectsList = objectsFromLocalStorage.startItems;
        endObjectsList = objectsFromLocalStorage.endItems;

        var  updatedTraceLinkType = objectsFromLocalStorage.traceLinkType;
        if( updatedTraceLinkType && updatedTraceLinkType.dbValue ) {
            if ( updatedTraceLinkType.dbValue !== TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL ) {
                data.dispatch( { path: 'data.fetchTracelinkProperty',   value: true } );
            }
            data.dispatch( { path: 'data.traceLinkType.dbValue',   value: updatedTraceLinkType.dbValue } );
            data.dispatch( { path: 'data.traceLinkType.uiValue',   value: updatedTraceLinkType.uiValue } );
            data.dispatch( { path: 'data.selectedTraceLinkType',   value: updatedTraceLinkType.dbValue } );
        }

        var objectsToLoad = [];
        if( modelObjectsList && modelObjectsList.length > 0 ) {
            objectsToLoad = objectsToLoad.concat( modelObjectsList );
        }
        if( endObjectsList && endObjectsList.length > 0 ) {
            objectsToLoad = objectsToLoad.concat( endObjectsList );
        }

        // ensure to load the objects
        if( objectsToLoad.length > 0 ) {
            var propertiesToLoad = [ 'awp0CellProperties', 'object_string' ];
            var objArray = [];
            objectsToLoad.forEach( elementUid => {
                objArray.push( {
                    uid: elementUid
                } );
            } );
            reqUtils.loadModelObjects( objArray, propertiesToLoad ).then( function() {
                setTimeout( function() {
                    parentData.startItems.dbValue = [];
                    parentData.endItems.dbValue = [];
                    for( var i = 0; i < modelObjectsList.length; i++ ) {
                        var objS = cdm.getObject( modelObjectsList[ i ] );
                        if( objS ) {
                            var flagS = _isExistRevObjectInArray( parentData.startItems.dbValue, objS );
                            if( !flagS ) {
                                parentData.startItems.dbValue.push( objS );
                            }
                        }
                    }
                    for( var j = 0; j < endObjectsList.length; j++ ) {
                        var objE = cdm.getObject( endObjectsList[ j ] );
                        if( objE ) {
                            var flagE = _isExistRevObjectInArray( parentData.endItems.dbValue, objE );
                            if( !flagE ) {
                                parentData.endItems.dbValue.push( objE );
                            }
                        }
                    }
                    eventBus.publish( 'CreateTracelink.refreshStartItemList' );
                    eventBus.publish( 'CreateTracelink.refreshEndItemList' );
                    createTracelinkPopupService.updateHeight();
                    _validateTraceLinkRule( parentData );
                    return {
                        viewExistingTracelink: viewExistingTracelink,
                        sourceObject: sourceObject,
                        modelProperty: modelProperty,
                        startItem: parentData.startItems.dbValue,
                        endItem: parentData.endItems.dbValue
                    };
                }, 0 );
            } );
        } else {
            // No object in start and/or end list
            parentData.startItems.dbValue = [];
            parentData.endItems.dbValue = [];
            eventBus.publish( 'CreateTracelink.refreshStartItemList' );
            eventBus.publish( 'CreateTracelink.refreshEndItemList' );
            createTracelinkPopupService.updateHeight();
        }
    } else {
        parentData.startItems.dbValue = _.clone( modelObjectsList );

        var arrModelObjs = parentData.startItems.dbValue;

        if( panelContext && panelContext.destObject ) {
            for( var j = 0; j < panelContext.destObject.length; j++ ) {
                parentData.endItems.dbValue.push( panelContext.destObject[ j ] );
            }
            arrModelObjs = arrModelObjs.concat( parentData.endItems.dbValue );
        }

        createTracelinkPopupService.updateLocalStorageData( data );

        var propertiesToLoad = [ 'awp0CellProperties', 'object_string' ];
        for( var ii = 0; ii <= arrModelObjs.length - 1; ii++ ) {
            if( _isOccurence( arrModelObjs[ ii ] ) ) {
                propertiesToLoad.push( 'awb0UnderlyingObject' );
                break;
            }
        }

        reqUtils.loadModelObjects( arrModelObjs, propertiesToLoad ).then( function() {
            setTimeout( function() {
                eventBus.publish( 'CreateTracelink.refreshStartItemList' );
                eventBus.publish( 'CreateTracelink.refreshEndItemList' );
                createTracelinkPopupService.updateHeight();
                _validateTraceLinkRule( parentData );
            }, 1000 );
        } );
    }

    var modelProperty = {};

    _checkObjectCopiedFromClipboard( ctx );

    eventBus.subscribe( 'clipboard.update', function() {
        _checkObjectCopiedFromClipboard( ctx );
    } );

    appCtxService.unRegisterCtx( 'rmTracelinkPanelContext' );
};

/**
 * Add in Start/End Item List.
 *
 * @param {Object} data - The view model data
 * @param {Object} newObjs - objects to be added in respective Item list
 */
export let addInItemList = function( data, newObjs ) {
    if( parentData.addInStartItemList ) {
        _addInObjectList( parentData, parentData.startItems, parentData.endItems, newObjs );
    } else if( parentData.addInEndItemList ) {
        _addInObjectList( parentData, parentData.endItems, parentData.startItems, newObjs );
    }
    createTracelinkPopupService.updateLocalStorageData( parentData );
};

/**
 * Generate Tracelink Types
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let generateTraceLinkTypes = function( data ) {
    if( data.selectedTraceLinkType ) {
        data.defaultTraceLinkType =  data.selectedTraceLinkType;
    } else if ( appCtxService.getCtx( 'preferences.TraceReport_Default_TraceLink_Type' ) &&
    appCtxService.getCtx( 'preferences.TraceReport_Default_TraceLink_Type' )[0] ) {
        data.defaultTraceLinkType = appCtxService.getCtx( 'preferences.TraceReport_Default_TraceLink_Type' )[0];
    } else {
        data.defaultTraceLinkType = TRACELINK_TYPE;
    }

    var bOTypeNamesResponse = [];
    var indexSpecEle = 0;
    if( data.outTraceLinkTypes ) {
        for( var i = 0; i < data.outTraceLinkTypes.length; i++ ) {
            var output = data.outTraceLinkTypes[ i ];
            var bOTypeNames = output.displayableBOTypeNames;

            for( var j in bOTypeNames ) {
                if( bOTypeNames[ j ] ) {
                    var listModel = _getEmptyListModel();
                    listModel.propDisplayValue = bOTypeNames[ j ].boDisplayName;
                    listModel.propInternalValue = bOTypeNames[ j ].boName;

                    if( bOTypeNames[ j ].boName === data.defaultTraceLinkType ) {
                        indexSpecEle = bOTypeNamesResponse.length;
                    }
                    bOTypeNamesResponse.push( listModel );
                }
            }
        }
    }

    allTracelinkTypes = bOTypeNamesResponse;

    // Loading default preference "REQ_default_tracelink_Types"

    return preferenceService.getMultiStringValues( [ 'REQ_default_tracelink_Types' ] ).then( function( prefs ) {
        var finalList = [];
        var pref = Object.keys( prefs );
        var prefValue = prefs[ pref ];

        //from SOA response, include only those types that are present in the default preference
        if( prefValue && prefValue.length > 0 ) {
            finalList = bOTypeNamesResponse.filter( ( tl_Type ) => prefValue.includes( tl_Type.propInternalValue ) );
        } else {
            // if default preference not found then load all types from soa response
            finalList = bOTypeNamesResponse;
        }
        //Add default tracelink type
        var listModelRuleBased = _getEmptyListModel();
        listModelRuleBased.propDisplayValue = TRACELINK_TYPE_RULE_BASED_DISPLAY_VAL;
        listModelRuleBased.propInternalValue = TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL;
        finalList.push( listModelRuleBased );

        finalList = _.sortBy( finalList, 'propDisplayValue' );

        // Save the default TL types list in the global variable for future use.
        defaultTraceLinkTypes = finalList;
        var traceLinkTypeList = data.traceLinkTypeList && data.traceLinkTypeList.length > 0 ? data.traceLinkTypeList : finalList;
        var traceLinkType = _.cloneDeep( data.traceLinkType );
        if( indexSpecEle === 0 && data.selectedTraceLinkType === TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL ) {
            traceLinkType.dbValue = TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL;
            traceLinkType.uiValue = TRACELINK_TYPE_RULE_BASED_DISPLAY_VAL;
        } else{
            traceLinkType.dbValue = bOTypeNamesResponse[ indexSpecEle ].propInternalValue;
            traceLinkType.uiValue = bOTypeNamesResponse[ indexSpecEle ].propDisplayValue;
        }
        if ( !data.selectedTraceLinkType || data.selectedTraceLinkType && data.selectedTraceLinkType !== traceLinkType.dbValue ) {
            _updateSelectedTraceLinkType( data, traceLinkType );
        }
        return { traceLinkTypeList: traceLinkTypeList, traceLinkType: traceLinkType, defaultTraceLinkType: data.defaultTraceLinkType };
    } );
};

var _updateSelectedTraceLinkType = function( data, traceLinkType ) {
    if( data.dispatch && traceLinkType && traceLinkType.dbValue ) {
        let shouldFetchTracelinkProperty = traceLinkType.dbValue !== TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL;
        parentData.selectedTraceLinkType = traceLinkType.dbValue;
        data.dispatch( { path: 'data.fetchTracelinkProperty',   value: shouldFetchTracelinkProperty } );
        data.dispatch( { path: 'data.selectedTraceLinkType',   value: traceLinkType.dbValue } );
    }
};

/**
 * Post create Link.
 *
 * @param {Object} data - the viewmodel data for this panel
 */
export let postCreateTracelink = function( data ) {
    var arrObjs = [];
    if( data.outputCreateRelation ) {
        for( var i = 0; i < data.outputCreateRelation.length; i++ ) {
            var objCreated = data.outputCreateRelation[ i ].tracelinkObject;

            if( objCreated ) {
                arrObjs.push( objCreated );
            }
        }
    }
    data.createdObject = arrObjs;
    var eventData = {
        relationObjects: arrObjs,
        startItems: data.startItems.dbValue,
        endItems: data.endItems.dbValue,
        serviceData: data.serviceData
    };
    eventBus.publish( 'RM.PostTraceLinkCreated', eventData );
};
/**
 * Show success message for trace link creation
 *
 * @param {Object} data - the viewmodel data for this panel
 */
export let showTracelinkCreationMessage = function( data ) {
    if( data.outputCreateRelation ) {
        if( !data.serviceData.partialErrors ) {
            msgSvc.showInfo( data.i18n.tracelinkSuccessMessage );
        } else if( data.serviceData.partialErrors.length > 0 ) {
            //Partial trace links created while One to Many trace link creation
            if( data.startItems.dbValue.length === 1 && data.endItems.dbValue.length > 1 ) {
                var msg = data.i18n.oneToManyPartialTracelinkSuccessMessage.replace( '{0}', data.startItems.dbValue[ 0 ].props.awb0UnderlyingObject ? data.startItems.dbValue[ 0 ].props
                    .awb0UnderlyingObject.uiValues[ 0 ] : data.startItems.dbValue[ 0 ].props.object_string.uiValues[ 0 ] );
                var msgstring = data.outputCreateRelation.length + '/' + data.endItems.dbValue.length;
                msg = msg.replace( '{1}', msgstring );
                msgSvc.showInfo( msg );
            }
            //Partial trace links created while Many to One trace link creation
            else if( data.endItems.dbValue.length === 1 && data.startItems.dbValue.length > 1 ) {
                var msgstring = data.outputCreateRelation.length + '/' + data.startItems.dbValue.length;
                var msg = data.i18n.ManyToOnePartialTracelinkSuccessMessage.replace( '{0}', msgstring );
                msg = msg.replace( '{1}', data.endItems.dbValue[ 0 ].props.awb0UnderlyingObject ? data.endItems.dbValue[ 0 ].props.awb0UnderlyingObject.uiValues[ 0 ] : data.endItems.dbValue[ 0 ].props
                    .object_string.uiValues[ 0 ] );
                msgSvc.showInfo( msg );
            }
        }
    }
};

/**
 * on event of tracelink type selection changed. Needs to fetch tracelink properties for selected tracelink type.
 *
 * @param {Object} data - the viewmodel data for this panel
 * @return {Object} returns values of fetchTracelinkProperty and traceLinkType dbvalue
 */
export let traceLinkTypeUpdated = function( data ) {
    var fetchTracelinkProperty = false;
    if( data.traceLinkType.dbValue !== TRACELINK_TYPE_RULE_BASED_INTERNAL_VAL ) {
        fetchTracelinkProperty = true;
    }
    parentData.traceLinkType = data.traceLinkType;
    parentData.selectedTraceLinkType = data.traceLinkType.dbValue;
    createTracelinkPopupService.updateLocalStorageData( parentData );
    return {
        fetchTracelinkProperty: fetchTracelinkProperty,
        selectedTraceLinkType : data.traceLinkType.dbValue
    };
};

/**
 * Returns the dbValue of the selected type
 *
 * @param {String} boDisplayName - the display Name of the type field
 *
 * @return {String} dbValue of the selected type
 */
export let getRowType = function( boDisplayName ) {
    return rowTypeMap[ boDisplayName ];
};

/**
 * set the pin on the data
 *
 * @return {Object} the model object
 */
export let setPin = function( data, ctx ) {
    data.isPanelPinned.dbValue = true;

    if( ctx ) {
        ctx.isPanelPinned = true;
        ctx.modelObjects = modelObjectsList;
    }
};

/**
 * set unpin on the data
 *
 * @return {Object} the model object
 */
export let setUnPin = function( data, ctx ) {
    data.isPanelPinned.dbValue = false;

    if( ctx ) {
        ctx.isPanelPinned = false;
        ctx.modelObjects = [];
    }
};

/**
 * @param {Object} targetObject - drop target object
 * @param {Array} sourceObjects - dragged sources objects
 * @returns {Promise} Resolved when all processing is complete.
 */
export let pasteObjectsInList = function( targetObject, sourceObjects ) {
    var deferred = AwPromiseService.instance.defer();

    if( targetObject && targetObject.uid === START_ITEM_LIST ) {
        _addInObjectList( parentData, parentData.startItems, parentData.endItems, sourceObjects );
    } else if( targetObject && targetObject.uid === END_ITEM_LIST ) {
        _addInObjectList( parentData, parentData.endItems, parentData.startItems, sourceObjects );
    }

    eventBus.publish( 'CreateTracelink.refreshStartItemList' );
    eventBus.publish( 'CreateTracelink.refreshEndItemList' );

    createTracelinkPopupService.updateLocalStorageData( parentData );

    if( parentData.errorManyToManyTracelink ) {
        deferred.reject( {
            message: parentData.i18n.notificationManytoManyTracelinkCreation
        } );
    } else {
        deferred.resolve();
    }

    return deferred.promise;
};

/**
 * Fire an event to navigate to the Add Item panel
 */
var _navigateToAddPanel = function() {
    var addTitle = '';
    if( parentData.addInStartItemList ) {
        addTitle = parentData.i18n.addInStartBucket;
    } else {
        addTitle = parentData.i18n.addInEndBucket;
    }
    var context = {
        title: addTitle
    };
    commandPanelService.activateCommandPanel( 'Arm0AddItemPanelSub', 'aw_toolsAndInfo', context );
};

/**
 * @param {Object} input - panelContext or the context.mselected
 * returns the model objects from the given input
 */

var _getNewModelObjects = function( input ) {
    var newModelObjects = [];
    if( !input ) {
        return newModelObjects;
    }

    if( input.sourceObject ) {
        var newModelObject = cdm.getObject( input.sourceObject.uid );
        newModelObjects.push( newModelObject );
    } else if( input.length ) {
        for( var i = 0; i < input.length; i++ ) {
            var curModelObject = cdm.getObject( input[ i ].uid );
            newModelObjects.push( curModelObject );
        }
    }

    return newModelObjects;
};

/**
 * @param {Object} newModelObjects - new model objects to be added to panel
 *
 */
var _addObjectsToTracelinkPanel = function( newModelObjects ) {
    // Show popup if not opened already
    if( !appCtxService.ctx.CreateTraceLinkPopupCtx ) {
        var context = undefined;
        if( newModelObjects.length === 1 ) {
            context = {
                sourceObject: newModelObjects
            };
        }
        createTracelinkPopupService.openTracelinkPopup( context );
        createTracelinkPopupService.updateHeight();
    } else {
        if( parentData && parentData.startItems && parentData.endItems ) {
            // If start list is empty, add the items in start list
            if( parentData.startItems.dbValue.length === 0 ) {
                _addInObjectList( parentData, parentData.startItems, parentData.endItems, newModelObjects );
            } else { // Add in end list
                var objectAdded = _addInObjectList( parentData, parentData.endItems, parentData.startItems,
                    newModelObjects );
                if( !objectAdded ) { // If adding in end list fails, add in start list to avoid ManyToManyTracelink
                    _addInObjectList( parentData, parentData.startItems, parentData.endItems, newModelObjects );
                }
            }
        }
    }
};

/**
 * Navigate to the Add Properties panel for Start Item List
 * @param {Object} data - the viewmodel data for this panel
 */
export let openAddPanelForStartItemList = function() {
    parentData.addInStartItemList = true;
    parentData.addInEndItemList = false;
    _navigateToAddPanel();
};

/**
 * Navigate to the Add Properties panel for End Item List
 * @param {Object} data - the viewmodel data for this panel
 */
export let openAddPanelForEndItemList = function() {
    parentData.addInStartItemList = false;
    parentData.addInEndItemList = true;
    _navigateToAddPanel();
};

/**
 * Process Model objects before adding on Start and End bucket
 * @param {Object} input - panelContext or the context.mselected
 * returns the model objects from the given input
 */

var _processTracebilityModelObjects = function( panelContext ) {
    var sourceModelObjects = [];
    var destModelObjects = [];

    if( panelContext.sourceObject ) {
        for( var i = 0; i < panelContext.sourceObject.uid.length; i++ ) {
            var obj1 = cdm.getObject( panelContext.sourceObject.uid[ i ] );
            sourceModelObjects.push( obj1 );
        }
    }
    if( panelContext.destObject ) {
        for( var j = 0; j < panelContext.destObject.uid.length; j++ ) {
            var obj2 = cdm.getObject( panelContext.destObject.uid[ j ] );
            destModelObjects.push( obj2 );
        }
    }
    parentData.rowProductContextFromMatrix = panelContext.rowProductContextFromMatrix;
    var arrModelObjs = sourceModelObjects.concat( destModelObjects );
    var cellProp = [ 'awp0CellProperties', 'awb0UnderlyingObject' ];

    reqUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
        var input = {};
        if( panelContext.rowProductContextFromMatrix || panelContext.isTraceabilityMatrixObject ) {
            parentData.rowProductContextFromMatrix = panelContext.rowProductContextFromMatrix;
            parentData.srcObjectFromMatrix = panelContext.sourceObject.uid;
            parentData.isTraceabilityMatrixObject = panelContext.isTraceabilityMatrixObject;
        }

        if( panelContext.sourceObject ) {
            var inputSourceArr = [];
            var inputDestArr = [];
            for( var i = 0; i < panelContext.sourceObject.uid.length; i++ ) {
                var inputObject = {
                    uid: panelContext.sourceObject.uid[ i ]
                };
                inputSourceArr.push( inputObject );
            }
            sourceModelObjects = _getNewModelObjects( inputSourceArr );
        }

        if( panelContext.destObject && inputDestArr ) {
            for( var j = 0; j < panelContext.destObject.uid.length; j++ ) {
                inputObject = {
                    uid: panelContext.destObject.uid[ j ]
                };
                inputDestArr.push( inputObject );
            }
            destModelObjects = _getNewModelObjects( inputDestArr );
        }

        if( appCtxService.ctx.CreateTraceLinkPopupCtx ) { // If panel is already active
            if( parentData && parentData.startItems && parentData.endItems ) {
                // If start list is empty, add the items in start list
                parentData.startItems.dbValue = [];
                parentData.endItems.dbValue = [];

                if( sourceModelObjects.length === 1 ) {
                    _addInObjectList( parentData, parentData.startItems, parentData.endItems, sourceModelObjects );
                }

                if( destModelObjects.length === 1 ) {
                    _addInObjectList( parentData, parentData.endItems, parentData.startItems,
                        destModelObjects );
                }

                createTracelinkPopupService.updateLocalStorageData( parentData );

                parentData.sourceObject = panelContext.sourceObject.uid;
                if( panelContext.viewExistingTracelink ) {
                    parentData.viewExistingTracelink = panelContext.viewExistingTracelink;

                    eventBus.publish( 'CreateTracelink.loadExistingTracelinks' );
                }
            }
        } else { // Activate panel & pass object through panel context.
            if( sourceModelObjects.length === 1 || destModelObjects.length === 1 ) {
                var context = {
                    sourceObject: sourceModelObjects,
                    destObject: destModelObjects,
                    viewExistingTracelink: panelContext.viewExistingTracelink

                };
            } else {
                context = null;
            }

            createTracelinkPopupService.openTracelinkPopup( context );
        }
    } );
};
/**
 * Add objects to create tracelink panel.
 *
 * @param {Object} panelContext - It contains sourceObject which needs to be added
 */
export let addObjectToTracelinkPanel = function( panelContext ) {
    if( panelContext.sourceObject && panelContext.destObject ) {
        _processTracebilityModelObjects( panelContext );
    } else if( panelContext.sourceObject && panelContext.viewExistingTracelink ) {
        // call to show Existing Tracelink
        parentData.sourceObject = panelContext.sourceObject.uid;
        parentData.viewExistingTracelink = panelContext.viewExistingTracelink;
    } else {
        var newModelObjects = _getNewModelObjects( panelContext );
        if( newModelObjects ) {
            _addObjectsToTracelinkPanel( newModelObjects );

            createTracelinkPopupService.updateLocalStorageData( parentData );
        }
    }
};

/**
 * This function handles selection from any of the clipboard/favorites/recent dataProvider on palette tab
 * @param {Object} ctx - ctx
 * @param {Object} data - the viewmodel data for this panel
 * @param {Object} dataProviderId - palette data provide ID
 * @param {Object} context - selected objects on clipboard/favorites/recent dataProvider on palette tab
 */
var lastContext = {
    getClipboardProvider: null,
    getFavoriteProvider: null,
    getRecentObjsProvider: null
};

export let handlePaletteSelection = function( ctx, data, dataProviderId, context ) {
    if( context._refire ) { return; }
    var dataProviderSet = Object.keys( lastContext );
    lastContext[ dataProviderId ] = context;
    var otherDataProviders = _.pull( dataProviderSet, dataProviderId );

    // Clear the selections on other two sections
    if( context.selectedObjects.length > 0 ) {
        for( var i = 0; i < otherDataProviders.length; i++ ) {
            if( ctx[ otherDataProviders[ i ] ] !== undefined ) {
                var dp = ctx[ otherDataProviders[ i ] ];
                if( dp.selectedObjects.length > 0 ) {
                    dp.selectionModel.setSelection( [] );
                }
            }
        }
        return {
            paletteSelection : context.selectedObjects
        };
    }
};

/**
 * Get selected objects from palette/search tab.
 * @param {Object} data - the viewmodel data for this panel
 * @returns {Any} selected objects from palette/search tab
 */
export let getSelectionAddPanel = function( data ) {
    var paletteSelection = [];
    if( data.addPanelState.sourceObjects.length > 0 ) {
        paletteSelection = data.addPanelState.sourceObjects;
        return paletteSelection;
    }
};

/**
 * Clear search results on search panel.
 * @param {Object} data - the viewmodel data for this panel
 */
export let clearSearchResult = function( data ) {
    data.dataProviders.performSearchInContext.viewModelCollection.clear();
    if( data.dataProviders.performSearch ) {
        data.dataProviders.performSearch.viewModelCollection.clear();
    }
};

/**
 * Set the selected objects on search panel.
 * @param {Object} data - the viewmodel data for this panel
 * @param {Object} selectedObjects - selected objects on search results
 */
export let handleSearchSelection = function( data, selectedObjects ) {
    if( data && selectedObjects ) {
        data.searchSelection = selectedObjects;
    }
};

/**
 * Swap the start and end objects of tracelink.
 */
export let swapStartAndEndItems = function() {
    if( parentData && parentData.startItems && parentData.endItems ) {
        reqTracelinkService.swapLists( parentData.startItems, parentData.endItems );

        _validateTraceLinkRule( parentData );
        createTracelinkPopupService.updateLocalStorageData( parentData );
    }
};

const clearCachedDragDropData = () => {
    awDragAndDropUtils._clearCachedData();
};

export const dragOverCustomHighlight = ( dragAndDropParams ) => {
    let sourceObjects = awDragAndDropUtils.getCachedDragData();
    var draggedObjects = [];
    sourceObjects.uidList.forEach( uid => {
        draggedObjects.push( cdm.getObject( uid ) );
    } );

    //get eligible tracelink object
    var eligibleDraggedObjects = _getTracelinkEligbleObjList( draggedObjects );

    var isValidSourceType = false;
    for( let i = 0; i < eligibleDraggedObjects.length; i++ ) {
        isValidSourceType = _isOccurence( eligibleDraggedObjects[ i ] ) || _isWorkspceObject( eligibleDraggedObjects[ i ] );
        if( !isValidSourceType ) {
            break;
        }
    }
    var isListItem = dragAndDropParams.targetElement.classList.contains( 'aw-widgets-cellListItem' );
    var dropTarget;
    if( isListItem ) {
        dropTarget = dragAndDropParams.targetElement.parentElement.parentElement.parentElement.parentElement;
    } else {
        dropTarget = dragAndDropParams.targetElement;
    }
    if( isValidSourceType ) {
        dragAndDropParams.callbackAPIs.highlightTarget( {
            isHighlightFlag: true,
            targetElement: dropTarget
        } );
        return {
            preventDefault: true,
            dropEffect: 'copy'
        };
    }
    return {
        dropEffect: 'none'
    };
};

export const dropCustomHighlight = ( dragAndDropParams ) => {
    let sourceObjects = awDragAndDropUtils.getCachedDragData();
    var targetObject = {
        targetObjectViewId: dragAndDropParams.declViewModel.getViewId()
    };
    if( targetObject.targetObjectViewId === 'Arm0StartItemList' ) {
        targetObject.uid = 'startItemList';
    } else if( targetObject.targetObjectViewId === 'Arm0EndItemList' ) {
        targetObject.uid = 'endItemList';
    } else {
        clearCachedDragDropData();
        return {
            preventDefault: false
        };
    }
    var draggedObjects = [];
    sourceObjects.uidList.forEach( uid => {
        draggedObjects.push( cdm.getObject( uid ) );
    } );

    //get eligible tracelink object
    var eligibleDraggedObjects = _getTracelinkEligbleObjList( draggedObjects );

    exports.pasteObjectsInList( targetObject, eligibleDraggedObjects );
    clearCachedDragDropData();
    return {
        preventDefault: true
    };
};

export let attachVMOToItemLists = ( data, isStartItemList ) => {
    var uid;
    var uiValue;
    if( isStartItemList ) {
        uid = START_ITEM_LIST;
        uiValue = 'Start';
    } else {
        uid = END_ITEM_LIST;
        uiValue = 'End';
    }
    var vmo = {
        uid: uid,
        props: {
            object_string: {
                uiValues: [ uiValue ]
            }
        },
        modelType: {
            typeHierarchyArray: [ 'CreateTracelink' ]
        }
    };
    return { vmo : vmo };
};

/**
 * Listens to clicks on tracelink tooltip view
 * @param {data} data of the active view
 */
export let initializeTracelinkClickListener = function( data ) {
    data.reviewSuspectClick = function( row ) {
        if( row.suspectReviewTaskList && row.suspectReviewTaskList.length > 0 ) {
            eventBus.publish( 'Arm0TracelinkTooltip.openSuspectTaskInNewTab', {
                sourceObjects: row.suspectReviewTaskList
            } );
        }
    };
    data.openMasterReq = function( row ) {
        if( row.isBasedOn ) {
            eventBus.publish( 'Arm0TracelinkTooltip.openObjectInNewTab', {
                sourceObject: row
            } );
        }
    };
    data.openTracelinkedObject = function( row ) {
        if( row.isTracelinkedItem ) {
            eventBus.publish( 'Arm0TracelinkTooltip.openObjectInNewTab', {
                sourceObject: row
            } );
        }
    };
    data.removeTracelinkedObject = function( row ) {
        if( row.isTracelinkedItem ) {
            eventBus.publish( 'requirementDocumentation.showDeleteTracelinkWarning', {
                sourceObject: row
            } );
        }
    };
};

export default exports = {
    removeFromStartItems,
    removeFromEndItems,
    pasteInStartItems,
    pasteInEndItems,
    getCreateTraceLinkInput,
    initStartItemList,
    addInItemList,
    generateTraceLinkTypes,
    postCreateTracelink,
    traceLinkTypeUpdated,
    getRowType,
    setPin,
    setUnPin,
    pasteObjectsInList,
    openAddPanelForStartItemList,
    openAddPanelForEndItemList,
    addObjectToTracelinkPanel,
    handlePaletteSelection,
    getSelectionAddPanel,
    clearSearchResult,
    handleSearchSelection,
    swapStartAndEndItems,
    dragOverCustomHighlight,
    dropCustomHighlight,
    attachVMOToItemLists,
    initializeTracelinkClickListener,
    showTracelinkCreationMessage
};
