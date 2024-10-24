// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epAssignmentIndicationService
 */

import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as _epLoadConstants } from 'js/epLoadConstants';
import _ from 'lodash';
import awPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import epReloadService from 'js/epReloadService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import localStorage from 'js/localStorage';
import epContextService from 'js/epContextService';
import soaService from 'soa/kernel/soaService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import localeSvc from 'js/localeService';
import mfeModelUtil from 'js/utils/mfeModelUtils';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import mfeSyncUtils from 'js/mfeSyncUtils';
import eventBus from 'js/eventBus';
import { renderComponent } from 'js/declReactUtils';
import { includeComponent } from 'js/moduleLoader';
import mfeVMOLifeCycleSvc from 'js/services/mfeViewModelObjectLifeCycleService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import epTableCellRenderer from 'js/epTableCellRenderer';
import epIndicationService from 'js/epIndicationService';

const singleConsumptionInScope = 'indicatorAssigned16';
const singleConsumptionOutOfScope = 'indicatorAssignedInOtherProcess16';
const MultipleConsumptionInScope = 'indicatorMultipleAssignments16';
const MultipleConsumptionOutOfScope = 'indicatorExternalMultipleAssignments16';
const netEffectivityMismatchInScope = 'indicatorPartialQuantityAssigned16';
const netEffectivityMismatchOutOfScope = 'indicatorPartialQuantityAssignedInOtherScope16';
const AccountabilityPropertyName = 'accountabilityResponse';
const AccountabilityAllocationIndicationPropertyName = 'accountabilityResponseAllocationIndication';
const localizedMsgs = localeSvc.getLoadedText( 'assignmentIndicationMessages' );
const Assignment_Indication_Find_In_Another_Scope = 'epAssignmentIndicationFindInAnotherScope';
const MCI_INSPECTION_REVISION = 'Mci0InspectionRevision';
const EP_ASSIGNMENT_INDICATION_ON_CLICK_EVENT = 'ep.assignmentIndicationIconClickEvent';
const TABLE_CELL_IMAGE_VIEW = 'MfeTableCellImage';
const TOOLTIP_VIEW = 'MfeGenericTooltip';
const TABLE_CELL_IMAGE_TOOLTIP_CLASS = 'aw-epAssignmentIndication-tableCellImageTooltip';

const matchTypeProp = 'matchType';

/**
 * This method Process relatedObjectsMap response and update it in property cache
 * @param { Object } relatedObjectsMap: SOA call response
 */
function processAccountabilityLoadResponseAndUpdateCache( relatedObjectsMap ) {
    let accountabilityResponse = {
        missingInSrc: [],
        singleConsumptionInScope: [],
        singleConsumptionOutOfScope: [],
        multipleConsumptionInScope: [],
        multipleConsumptionOutOfScope: []
    };
    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;

    if( relatedObjectsMap ) {
        _.forEach( relatedObjectsMap, relatedObject => {
            let missingSrc = relatedObject.additionalPropertiesMap2[ epLoadConstants.MISSING_IN_SOURCE ];
            let inScopeSingleConsume = relatedObject.additionalPropertiesMap2[ epLoadConstants.SINGLE_CONSUMPTION_IN_SCOPE ];
            let outScopeSingleConsume = relatedObject.additionalPropertiesMap2[ epLoadConstants.SINGLE_CONSUMPTION_OUT_OF_SCOPE ];
            let inScopeMultipleConsume = relatedObject.additionalPropertiesMap2[ epLoadConstants.MULTIPLE_CONSUMPTION_IN_SCOPE ];
            let outScopeMultipleConsume = relatedObject.additionalPropertiesMap2[ epLoadConstants.MULTIPLE_CONSUMPTION_OUT_OF_SCOPE ];

            if( missingSrc ) {
                accountabilityResponse.missingInSrc = [ ..._.map( missingSrc, ( uid ) => cdm.getObject( uid ) ) ];
            }
            if( inScopeSingleConsume ) {
                accountabilityResponse.singleConsumptionInScope.push( inScopeSingleConsume );
            }
            if( outScopeSingleConsume ) {
                accountabilityResponse.singleConsumptionOutOfScope.push( outScopeSingleConsume );
            }
            if( inScopeMultipleConsume ) {
                accountabilityResponse.multipleConsumptionInScope.push( inScopeMultipleConsume );
            }
            if( outScopeMultipleConsume ) {
                accountabilityResponse.multipleConsumptionOutOfScope.push( outScopeMultipleConsume );
            }
        } );
    }
    epObjectPropertyCacheService.setProperty( contextObjectUid, AccountabilityPropertyName, accountabilityResponse );
}

/**
 * This method takes Array of VMOs and updates each VMO's assignmentIndication prop value.
 * @param { ObjectArray } vmos: ViewModelObjects to update
 * @param { Boolean } toggleIndicationValue: If Indication toggle is on/off
 * @param { String } propertyValue: based on this vmo property decide indication state, e.g :'matchType'
 */
export function updateIndicationMatchPropertyOnVmos( vmos, toggleIndicationValue, propertyValue ) {
    if( _.isArray( vmos ) ) {
        vmos.forEach( ( vmo ) => {
            updateIndicationMatchPropertyOnVmo( vmo, toggleIndicationValue, propertyValue );
        } );
    }
}

/**
 * This method takes single VMO and update its assignmentIndication prop value.
 *
 * @param { Object } vmo: ViewModelObject to update
 * @param { Boolean } toggleIndicationValue: If Indication toggle is on/off
 * @param { String } propertyValue: based on this vmo property decide indication state, e.g :'matchType'
 * @returns {Object} ViewModelObject
 */
function updateIndicationMatchPropertyOnVmo( vmo, toggleIndicationValue, propertyValue ) {
    let imageName;
    const assignmentIndication = {
        value: '4',
        displayValue: '4',
        propType: 'STRING',
        dbValue: '4',
        dbValues: [ '4' ],
        displayValues: [ '4' ],
        displayName: 'assignmentIndication',
        image: undefined,
        matchType: '4',
        maxArraySize: 1,
        uiValue: '4',
        uiValues: [ '4' ],
        isEditable: false,
        isModifiable: false
    };
    vmo.props.assignmentIndication = viewModelObjectSvc.constructViewModelProperty( assignmentIndication, 'assignmentIndication', vmo, false );
    vmo.props.assignmentIndication.editable = false;

    if( toggleIndicationValue ) {
        const result = epObjectPropertyCacheService.getProperty( vmo.uid, propertyValue );
        const matchType = result !== '' && result !== undefined ? result[ 0 ] : '';
        switch ( matchType ) {
            case '101':
            case '105':
                epIndicationService.updateIndicationPropDataOnVmo( vmo, singleConsumptionInScope, matchType );
                break;
            case '102':
            case '106':
                epIndicationService.updateIndicationPropDataOnVmo( vmo, singleConsumptionOutOfScope, matchType );
                break;
            case '103':
                epIndicationService.updateIndicationPropDataOnVmo( vmo, MultipleConsumptionInScope, matchType );
                break;
            case '104':
                epIndicationService.updateIndicationPropDataOnVmo( vmo, MultipleConsumptionOutOfScope, matchType );
                break;
            case '107':
                epIndicationService.updateIndicationPropDataOnVmo( vmo, netEffectivityMismatchInScope, matchType );
                break;
            case '108':
                epIndicationService.updateIndicationPropDataOnVmo( vmo, netEffectivityMismatchOutOfScope, matchType );
                break;
            default:
                break;
        }
    }
    return vmo;
}

/**
 * Render Assignment Indication on cell.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
export function rendererForAssignmentIndication( vmo, containerElement ) {
    if( !containerElement ) {
        return;
    }
    let assignmentIndication;
    let contextObject = {};
    if( vmo.props && vmo.props.assignmentIndication && vmo.props.assignmentIndication.value !== '4' ) {
        assignmentIndication = vmo.props.assignmentIndication;
        contextObject.indicationMatchType = assignmentIndication.matchType;
        contextObject.reference = mfeModelUtil.getUniqueIdFromVmo( vmo.uid );
    }
    const iconId = assignmentIndication && assignmentIndication.image ? assignmentIndication.image : '';
    if( iconId ) {
        contextObject.reference = containerElement;
        contextObject.popupReferenceElement = containerElement.parentElement;
        const tooltipData = getTooltipData( contextObject );
        const props = {
            imageSrc: iconId,
            tooltipView: TOOLTIP_VIEW,
            tooltipData,
            isClickable: true
        };
        const imageElement = includeComponent( TABLE_CELL_IMAGE_VIEW, props );
        containerElement.addEventListener( 'click', function() {
            contextObject.nodeToFindId = vmo.uid;
            eventBus.publish( EP_ASSIGNMENT_INDICATION_ON_CLICK_EVENT, {
                contextObject
            } );
        }, false );
        renderComponent( imageElement, containerElement );
    }
}

/**
 * Renderer Consumption Indication column header
 *
 * @param {DOMElement} containerElement - the icon container element
 * @param {String} columnField - column field name
 * @param {Object} tooltip - tooltip object
 * @param {Object} column - column object
 */
function renderIndicationColumnHeader( containerElement, columnField, tooltip, column ) {
    epTableCellRenderer.columnHeaderIndicationRenderer( containerElement, columnField, column );
}

/**
 * show Tooltip On Hover Of Cell Icon.
 *
 * @param { Object } contextObject - the vmo for the cell
 * @returns {Object} tooltip data
 */
function getTooltipData( contextObject ) {
    let title = '';
    let instruction = '';
    let messages = '';
    switch ( contextObject.indicationMatchType ) {
        case '101':
        case '105':
            title = localizedMsgs.singleConsumptionInScopeTooltipText;
            instruction = localizedMsgs.clickDescription;
            break;
        case '102':
        case '106':
            title = localizedMsgs.singleConsumptionOutOfScopeTooltipText;
            instruction = localizedMsgs.clickDescription;
            break;
        case '103':
            title = localizedMsgs.multipleConsumptionInScopeTooltipText;
            instruction = localizedMsgs.clickDescription;
            break;
        case '104':
            title = localizedMsgs.multipleConsumptionOutOfScopeTooltipText;
            instruction = localizedMsgs.clickDescription;
            break;
        case '107':
            title = localizedMsgs.netEffectivityMismatchInScopeTitle;
            messages = [ localizedMsgs.netEffectivityMismatchInformation ];
            instruction = localizedMsgs.clickDescription;
            break;
        case '108':
            title = localizedMsgs.netEffectivityMismatchOutOfScopeTitle;
            messages = [ localizedMsgs.netEffectivityMismatchInformation ];
            instruction = localizedMsgs.clickDescription;
            break;
    }
    return {
        extendedTooltip: {
            title,
            instruction,
            messages,
            className: TABLE_CELL_IMAGE_TOOLTIP_CLASS
        }
    };
}

/**
 * This method updates Missing In source count and Consumption indication count. This count is visible beside toggle button.
 * @param {Boolean} assignmentIndicationMode: Indication toggle on/off
 * @param {Object} overConsumedInfoChips existing overConsumedInfoChips:
 * @returns {object} modified overConsumedInfoChips;
 */
function getAssignmentIndicationCount( assignmentIndicationMode, overConsumedInfoChips ) {
    if( assignmentIndicationMode ) {
        let overConsumedCount = 0;
        let missingInSrcCount = 0;

        const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
        let accountabilityCachedResponse = epObjectPropertyCacheService.getProperty( contextObjectUid, AccountabilityPropertyName );
        if( accountabilityCachedResponse.multipleConsumptionInScope && accountabilityCachedResponse.multipleConsumptionOutOfScope ) {
            overConsumedCount = accountabilityCachedResponse.multipleConsumptionInScope.length + accountabilityCachedResponse.multipleConsumptionOutOfScope.length;
        }
        if( accountabilityCachedResponse.missingInSrc ) {
            missingInSrcCount = accountabilityCachedResponse.missingInSrc.length;
        }

        _.forEach( overConsumedInfoChips.dbValues, dbValue => {
            if( dbValue.countOf === 'OverConsumedIndication' ) {
                dbValue.labelDisplayName = overConsumedCount;
                dbValue.labelInternalName = overConsumedCount;
            } else {
                dbValue.labelDisplayName = missingInSrcCount;
                dbValue.labelInternalName = missingInSrcCount;
            }
        } );
    }
    return overConsumedInfoChips;
}

/**
 * This method clears cached data once Indication toggle is turned off.
 * @param {Boolean} indicationMode : Assignment Indication toggle on/off
 * @param { String } key: input for epReloadService.unregisterReloadInput
 */
export function destroy( indicationMode, key ) {
    if( !indicationMode ) {
        epReloadService.unregisterReloadInput( key );
        const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
        epObjectPropertyCacheService.clearPropertyKeyCache( contextObjectUid, AccountabilityPropertyName );
    }

    // After navigating out of scope, if we change task in older tab then toggle remains on so clear localStorage
    localStorage.removeItem( Assignment_Indication_Find_In_Another_Scope );
}

/**
 *
 * @param {Object} findNodeInContextInputObject find node in context input object
 * @returns {Object} assigned in data
 */
export function loadAssignmentIndicationAssignedInData( findNodeInContextInputObject ) {
    let assignmentIndicationAssignedIn = {};
    const awPromise = awPromiseService.instance;
    if( epObjectPropertyCacheService.getProperty( findNodeInContextInputObject.nodeToFind, 'foundNodes' ) ) {
        assignmentIndicationAssignedIn = getAssignmentIndicationAssignedInDataFromCache( findNodeInContextInputObject.nodeToFind );
        return awPromise.resolve( assignmentIndicationAssignedIn );
    }
    const addLoadParams = [ {
            tagName: 'searchType',
            attributeName: 'type',
            attributeValue: findNodeInContextInputObject.searchType
        },
        {
            tagName: 'currentScope',
            attributeName: 'objectUid',
            attributeValue: findNodeInContextInputObject.currentScope.uid
        },
        {
            tagName: 'nodesToFind',
            attributeName: 'objectUid',
            attributeValue: findNodeInContextInputObject.nodeToFind
        },
        {
            tagName: 'contextObject',
            attributeName: 'objectUid',
            attributeValue: findNodeInContextInputObject.contextObject.uid
        }
    ];
    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( _epLoadConstants.FIND_NODE_IN_CONTEXT, '', '', '', addLoadParams );
    const jsonInput = epLoadInputHelper.getLoadInputJSON( loadTypeInputs );
    const promise = soaService.postUnchecked( 'Internal-MfgBvrCore-2015-03-DataManagement', 'loadObjectData3',
        jsonInput );
    return promise.then( function( response ) {
        if( response ) {
            const relatedObjectsMap = response.relatedObjectsMap;
            if( relatedObjectsMap ) {
                for( let relatedObject in relatedObjectsMap ) {
                    epObjectPropertyCacheService.setProperties( relatedObject,
                        relatedObjectsMap[ relatedObject ].additionalPropertiesMap2 );
                }
            }
            if( findNodeInContextInputObject.searchType === _epLoadConstants.FIND_NODE_IN_CONTEXT ) {
                assignmentIndicationAssignedIn = getAssignmentIndicationAssignedInDataFromCacheProductBOPPage( findNodeInContextInputObject.nodeToFind );
            } else {
                assignmentIndicationAssignedIn = getAssignmentIndicationAssignedInDataFromCache( findNodeInContextInputObject.nodeToFind );
            }
        }
        return awPromise.resolve( assignmentIndicationAssignedIn );
    } );
}

/**
 *
 * @param {*} inputObjectUid
 * @returns
 */
function getAssignmentIndicationAssignedInDataFromCacheProductBOPPage( inputObjectUid ) {
    let assignmentIndicationAssignedIn = {};
    assignmentIndicationAssignedIn.foundNodes = [];
    assignmentIndicationAssignedIn.inScopeNodes = [];
    assignmentIndicationAssignedIn.outOfScopeNodes = [];
    const foundNodes = epObjectPropertyCacheService.getProperty( inputObjectUid, 'foundNodes' );
    if( foundNodes ) {
        assignmentIndicationAssignedIn.foundNodes = foundNodes;
        foundNodes.forEach( foundNode => {
            const foundNodeObject = cdm.getObject( foundNode );
            const inScopeUid = foundNodeObject.props.bl_parent.dbValues[ 0 ];
            if( inScopeUid ) {
                const vmo = viewModelObjectSvc.createViewModelObject( inScopeUid );
                if( vmo ) {
                    assignmentIndicationAssignedIn.inScopeNodes.push( {
                        vmo: vmo,
                        additionalData: {
                            socpeVsFoundNode: foundNodeObject
                        }
                    } );
                }
            }
        } );
    }
    return assignmentIndicationAssignedIn;
}

/**
 *
 * @param {*} inputObjectUid
 * @returns
 */
function getAssignmentIndicationAssignedInDataFromCache( inputObjectUid ) {
    let assignmentIndicationAssignedIn = {};
    assignmentIndicationAssignedIn.foundNodes = [];
    assignmentIndicationAssignedIn.inScopeNodes = [];
    assignmentIndicationAssignedIn.outOfScopeNodes = [];
    const foundNodes = epObjectPropertyCacheService.getProperty( inputObjectUid, 'foundNodes' );
    if( foundNodes ) {
        assignmentIndicationAssignedIn.foundNodes = foundNodes;
        const inScopeNodes = epObjectPropertyCacheService.getProperty( inputObjectUid, 'inScopeNodes' );
        const outOfScopeNodes = epObjectPropertyCacheService.getProperty( inputObjectUid, 'outOfScopeNodes' );
        if( inScopeNodes ) {
            let foundNodeObjects = [];
            _.forEach( foundNodes, foundNode => {
                foundNodeObjects.push( cdm.getObject( foundNode ) );
            } );
            for( let element in inScopeNodes ) {
                const socpeVsFoundNode = getSocpeVsFoundNode( inScopeNodes[ element ], foundNodeObjects );
                const vmo = viewModelObjectSvc.createViewModelObject( inScopeNodes[ element ] );
                const additionalData = {
                    socpeVsFoundNode: socpeVsFoundNode
                };
                if( vmo ) {
                    assignmentIndicationAssignedIn.inScopeNodes.push( {
                        vmo: vmo,
                        additionalData: additionalData
                    } );
                }
            }
        }
        if( outOfScopeNodes ) {
            for( let element in outOfScopeNodes ) {
                const socpeVsFoundNodeUid = epObjectPropertyCacheService.getProperty( outOfScopeNodes[ element ], 'socpeVsFoundNode' );
                const socpeVsFoundNode = cdm.getObject( socpeVsFoundNodeUid[ 0 ] );
                const vmo = viewModelObjectSvc.createViewModelObject( outOfScopeNodes[ element ] );
                const additionalData = {
                    socpeVsFoundNodeUid: socpeVsFoundNode
                };
                if( vmo ) {
                    assignmentIndicationAssignedIn.outOfScopeNodes.push( {
                        vmo: vmo,
                        additionalData: additionalData
                    } );
                }
            }
        }
    }
    return assignmentIndicationAssignedIn;
}

/**
 *
 * @param {*} inScopeObjectUid
 * @param {*} foundNodeObjects
 * @returns
 */
function getSocpeVsFoundNode( inScopeObjectUid, foundNodeObjects ) {
    for( let element in foundNodeObjects ) {
        if( inScopeObjectUid === foundNodeObjects[ element ].props.bl_parent.dbValues[ 0 ] ) {
            const foundNodeObj = foundNodeObjects[ element ];
            foundNodeObjects.splice( element, 1 );
            return foundNodeObj;
        }
    }
    return null;
}

/**
 *
 * @param {*} inputObjectUid
 */
export function cleanUpAssignmentIndicationAssignedInDataFromCache( inputObjectUid ) {
    if( inputObjectUid ) {
        epObjectPropertyCacheService.clearPropertyKeyCache( inputObjectUid, 'foundNodes' );
        epObjectPropertyCacheService.clearPropertyKeyCache( inputObjectUid, 'inScopeNodes' );
        const outOfScopeNodes = epObjectPropertyCacheService.getProperty( inputObjectUid, 'outOfScopeNodes' );
        _.forEach( outOfScopeNodes, outOfScopeNodeUid => {
            epObjectPropertyCacheService.clearPropertyKeyCache( outOfScopeNodeUid, 'socpeVsFoundNode' );
        } );
        epObjectPropertyCacheService.clearPropertyKeyCache( inputObjectUid, 'outOfScopeNodes' );
    }
}

/**
 *
 * @param {Object} inputObject input object
 * @returns {Object} process or operation and part to be selected
 */
function updateDataAndGetProcessOrOperationTobeSelected( inputObject ) {
    let selectionData = {
        processOrOperationTobeSelected: null,
        partTobeSelected: null,
        hasProcessOrOperationTobeSelected: false,
        hasPartTobeSelected: false,
        hasPmiTobeSelected: false
    };
    if( inputObject && inputObject !== '' ) {
        selectionData.processOrOperationTobeSelected = inputObject.vmo ? inputObject.vmo : inputObject;
        selectionData.hasProcessOrOperationTobeSelected = true;
        if( inputObject.additionalData && inputObject.additionalData.socpeVsFoundNode ) {
            selectionData.partTobeSelected = inputObject.additionalData.socpeVsFoundNode;
            selectionData.hasPartTobeSelected = true;
        }
        if( inputObject.additionalData && inputObject.additionalData.relatedPmiObject ) {
            selectionData.pmiTobeSelected = inputObject.additionalData.relatedPmiObject;
            selectionData.hasPmiTobeSelected = true;
        }
    }
    return selectionData;
}

/**
 *
 * @param {*} processOrOperationTobeSelected
 * @param {*} partsToBeSelected
 * @param {*} key
 * @param {*} scopedObject
 */
export function cacheSelectionObjectToLocalStorage( processOrOperationTobeSelected, partsToBeSelected, key, scopedObject ) {
    if( processOrOperationTobeSelected && partsToBeSelected ) {
        const selectionObjects = {
            [ scopedObject ]: {
                selectionInProcessTree: viewModelObjectSvc.createViewModelObject( processOrOperationTobeSelected ),
                selectionInPartsTab: partsToBeSelected
            }
        };
        localStorage.publish( key, JSON.stringify( selectionObjects ) );
    }
}

/**
 * This method returns Node ( process/part/operation ) to be selected.
 * @param { String } key: key for localStorage
 * @param { Object } scopedObject: Scope of page, against this object selection of process / part is fetched from storage
 * @returns { Object } nodesTobSelected - {
 * processOrOperationTobeSelected,
 * partsTobeSelected
 * }
 */
export function getNodeToBeSelectedFromLocalStorage( key, scopedObject ) {
    const selectionFromLocalStorage = localStorage.get( key );
    const selectionObjects = selectionFromLocalStorage && JSON.parse( selectionFromLocalStorage );
    let nodesTobSelected = {
        processOrOperationTobeSelected: {},
        partsTobeSelected: {}
    };
    if( selectionObjects && scopedObject ) {
        nodesTobSelected.processOrOperationTobeSelected = selectionObjects[ scopedObject ].selectionInProcessTree;
        nodesTobSelected.partsTobeSelected = selectionObjects[ scopedObject ].selectionInPartsTab;
    }

    return nodesTobSelected;
}

/**
 * This method listens ep.accountabilityEvents and as per its eventData updates AccountabilityResponse in epObjectPropertyCacheService
 *
 * @param { Boolean } assignmentIndicationMode: Indication toggle on/off
 * @param { Object } accountabilityEvents - {
 *  missingInSrc: [],
 *  singleConsumptionInScope: [],
 *  singleConsumptionOutOfScope: [],
 *  multipleConsumptionInScope: [],
 *  multipleConsumptionOutOfScope: []
 * }
 */
export function updateAccountabilityResponseCache( assignmentIndicationMode, accountabilityEvents ) {
    if( assignmentIndicationMode ) {
        const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
        let missingInSrcObjects = [];

        if( accountabilityEvents.missingInSrc.length > 0 ) {
            missingInSrcObjects = [ ..._.map( accountabilityEvents.missingInSrc, ( uid ) => cdm.getObject( uid ) ) ];
        }
        const accountabilityUpdatedResponse = {
            missingInSrc: sortMissingInSourceList( missingInSrcObjects ),
            singleConsumptionInScope: accountabilityEvents.singleConsumptionInScope,
            singleConsumptionOutOfScope: accountabilityEvents.singleConsumptionOutOfScope,
            multipleConsumptionInScope: accountabilityEvents.multipleConsumptionInScope,
            multipleConsumptionOutOfScope: accountabilityEvents.multipleConsumptionOutOfScope
        };
        epObjectPropertyCacheService.setProperty( contextObjectUid, AccountabilityPropertyName, accountabilityUpdatedResponse );
    }
}

/**
 * the method sorts the list of missing in source so the first elements are of bvrPart type and then the inspection pmis
 *
 * @param { ModelObject } missingInSourceObjectsList - the missing in source list
 * @return { ModelObject } the sorted missing in source list
 */
function sortMissingInSourceList( missingInSourceObjectsList ) {
    if( missingInSourceObjectsList.length > 0 ) {
        let sortedMissingInSourceObjectsList = [];
        missingInSourceObjectsList.forEach( missingInSourceObj => {
            if( mfeTypeUtils.isOfType( missingInSourceObj, MCI_INSPECTION_REVISION ) ) {
                sortedMissingInSourceObjectsList.push( missingInSourceObj );
            } else {
                sortedMissingInSourceObjectsList.unshift( missingInSourceObj );
            }
        } );
        return sortedMissingInSourceObjectsList;
    }
    return [];
}

/**
 * Get single input object
 * @param {Object} viewModelData the ViewModel data
 * @param {Object} newInput the new Input
 */
export function handleNewInputForSingleObject( viewModelData, newInput ) {
    let outputObject = mfeSyncUtils.handleNewInputForSingleObject( viewModelData, newInput );

    if( outputObject && ( Array.isArray( outputObject.inputObject ) && outputObject.inputObject.length === 0 || !outputObject.inputObject ) ) {
        outputObject.isInputObjectUpdated = false;
    }
    return outputObject;
}

/**
 *
 * @param {boolean} isMciTemplateDeployed ture if mci0mfgcharacteristics template deployed in DB
 * @returns {string[]} array of check type
 */
export function getCheckType( isMciTemplateDeployed ) {
    const checkType = [ 'ProductProcessBop' ];
    if( isMciTemplateDeployed ) {
        checkType.push( 'MissingInSourcePMI' );
    }
    return checkType;
}

/**
 * Register Reload For Current Scope Input
 * @param {boolean} isMciTemplateDeployed ture if mci0mfgcharacteristics template deployed in DB
 * @param { Object } currentScope: current scope object
 * @param { Object } sourceObject: source Object
 * @param { Object } targetObject: target object
 */
export function registerReloadForCurrentScopeInput( isMciTemplateDeployed, currentScope, sourceObject, targetObject ) {
    const checkType = epIndicationService.getCheckType( isMciTemplateDeployed );
    if( currentScope && sourceObject && targetObject ) {
        const additionalLoadParams = [ {
                tagName: 'checkType',
                attributeName: 'type',
                attributeValue: checkType
            },
            {
                tagName: 'currentScope',
                attributeName: 'objectUid',
                attributeValue: currentScope
            },
            {
                tagName: 'sourceObject',
                attributeName: 'objectUid',
                attributeValue: sourceObject
            },
            {
                tagName: 'targetObject',
                attributeName: 'objectUid',
                attributeValue: targetObject.uid
            }
        ];

        epReloadService.registerReloadInput( 'epAssignmentIndication', { reloadTypeName: 'AccountabilityCheck', additionalLoadParams: additionalLoadParams } );
    }
}

/**
 * @param {Object} saveEventData - the 'ep.saveEvnets' data object
 */
function handleSaveEvents( saveEventData ) {
    let saveEvents = saveEventData.saveEvents;
    saveEvents.forEach( ( saveEvent ) => {
        if( saveEvent.eventType === epSaveConstants.DELETE ) {
            mfeVMOLifeCycleSvc.deleteVmosFromCache( saveEvent.eventObjectUid );
        } else {
            if( saveEvent.eventType === epSaveConstants.ACCOUNTABILITYCHECK_EVENT ) {
                const matchTypeArr = [ ...saveEvent.eventData ].splice( 0, 1 );
                const propertyValue = {
                    [ saveEvent.eventData[ 0 ] ]: matchTypeArr,
                    [ matchTypeProp ]: [ saveEvent.eventData[ 0 ] ]
                };
                epObjectPropertyCacheService.setProperties( saveEvent.eventObjectUid, propertyValue );
            }
        }
    } );
}

/**
 * getTargetObject
 * @param {Boolean} isInProductBOPPage isInProductBOPPage
 * @param {boolean} processStructure processStructure
 * @param {boolean} productBOP productBOP
 * @returns {ModelObject} target object
 */
export function getTargetObject( isInProductBOPPage, processStructure, productBOP ) {
    return epIndicationService.getTargetObject( isInProductBOPPage, processStructure, productBOP );
}

export default {
    processAccountabilityLoadResponseAndUpdateCache,
    updateIndicationMatchPropertyOnVmos,
    rendererForAssignmentIndication,
    updateIndicationMatchPropertyOnVmo,
    getAssignmentIndicationCount,
    destroy,
    loadAssignmentIndicationAssignedInData,
    cleanUpAssignmentIndicationAssignedInDataFromCache,
    updateDataAndGetProcessOrOperationTobeSelected,
    cacheSelectionObjectToLocalStorage,
    getNodeToBeSelectedFromLocalStorage,
    updateAccountabilityResponseCache,
    handleNewInputForSingleObject,
    getCheckType,
    registerReloadForCurrentScopeInput,
    handleSaveEvents,
    renderIndicationColumnHeader,
    getTargetObject
};
