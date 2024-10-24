// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epAllocationIndicationService
 */

import epTableCellRenderer from 'js/epTableCellRenderer';
import localeSvc from 'js/localeService';
import { includeComponent } from 'js/moduleLoader';
import eventBus from 'js/eventBus';
import { renderComponent } from 'js/declReactUtils';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import epContextService from 'js/epContextService';
import localeService from 'js/localeService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import epReloadService from 'js/epReloadService';
import typeDisplayNameService from 'js/typeDisplayName.service';

/**
 * 0 - icon
 * 1 - tooltip title
 * 2 - tooltip message
 * 3 - tooltip instructions
 */
const sourceIndicationsRenderData = {
    SINGLE_MATCH: [ 'indicatorAssigned16', 'singleAllocatedTooltipText', '', 'singleAllocatedTooltipInstructionForProductBop' ],
    MULTIPLE_MATCH: [ 'miscMultipleAssignments16', 'multipleAllocationTooltipText', '', 'multipleAllocatedTooltipInstructionForProductBop' ],
    PARTIAL_SINGLE_MATCH: [ 'indicatorSingleAssignedMismatch16', 'singleAllocatedMismatchTooltipText', 'mismatchTooltipDescForProductBop', 'singleAllocatedTooltipInstructionForProductBop' ],
    PARTIAL_MULTIPLE_MATCH: [ 'indicatorMultipleAssignmentsMismatch16', 'multipleAllocatedMismatchTooltipText', 'mismatchTooltipDescForProductBop', 'multipleAllocatedTooltipInstructionForProductBop' ],
    OUTOFSCOPE_SINGLE_MATCH: [ 'indicatorAssignedInOtherProcess16', 'singleOutOfScopeTooltipText', 'singleOutOfScopeTooltipDesc', '' ],
    OUTOFSCOPE_MULTIPLE_MATCH: [ 'indicatorExternalMultipleAssignments16', 'multipleOutOfScopeTooltipText', 'multipleOutOfScopeTooltipDesc', '' ]
};

const targetIndicationsRenderData = {
    MISSING_IN_SOURCE: [ 'indicatorAssignedMissingInSource16', 'missingInSourceForPlantBopTooltipTitle', 'missingInSourceForPlantBopTooltipText', '' ],
    SINGLE_MATCH: [ 'indicatorAssigned16', 'singleAllocatedTooltipText', 'allocatedTooltipMessage', 'allocatedTooltipInstruction' ],
    MULTIPLE_MATCH: [ 'indicatorAssigned16', 'singleAllocatedTooltipText', 'allocatedTooltipMessage', 'allocatedTooltipInstruction' ],
    PARTIAL_SINGLE_MATCH: [ 'indicatorSingleAssignedMismatch16', 'singleAllocatedMismatchTooltipText', 'mismatchTooltipDesc', 'moreOptions' ],
    PARTIAL_MULTIPLE_MATCH: [ 'indicatorSingleAssignedMismatch16', 'singleAllocatedMismatchTooltipText', 'mismatchTooltipDesc', 'moreOptions' ]
};

const localizedMsgs = localeSvc.getLoadedText( 'allocationIndicationMessages' );
const TOOLTIP_VIEW = 'MfeGenericTooltip';
const TABLE_CELL_IMAGE_VIEW = 'MfeTableCellImage';
const EP_ALLOCATION_INDICATION_ON_CLICK_EVENT = 'ep.allocationIndicationIconClickEvent';
// cached data keys
const allocationIndicationMissingInSource = 'accountabilityResponse';
const allocationIndicationTargetToSource = 'allocationIndicationTargetToSource';
const allocationIndicationSourceToTarget = 'allocationIndicationSourceToTarget';
const allocationIndicationObjectToParentStation = 'allocationIndicationobjectToParentStation';

const ALLOCATION_INDICATION_RELOAD = 'balancingAllocationIndication';
const AC_COMPARE_PROPERTIES = 'ACPropertiesCompare';

let balancingStations = [];

/**
 *
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
 * Render Allocation Indication on cell.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 * @param {String} structureType: PlantBOP/ProductBOP
 */
function rendererForAllocationIndication( vmo, containerElement, structureType ) {
    if( !containerElement ) {
        return;
    }

    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    const propertyName = structureType === epBvrConstants.MFG_PRODUCT_BOP ? allocationIndicationSourceToTarget : allocationIndicationTargetToSource;
    const matchData = epObjectPropertyCacheService.getProperty( contextObjectUid, propertyName );
    const scopeName = typeDisplayNameService.instance.getDisplayName( cdm.getObject( contextObjectUid ) );

    let indicationMatchType;
    let mixed = false;

    if( matchData && matchData[ vmo.uid ] ) {
        indicationMatchType = matchData[ vmo.uid ].matchType;
        mixed = matchData[ vmo.uid ].mixed;
    } else if( structureType === epBvrConstants.MFG_PLANT_BOP ) {
        const missingInSrc = epObjectPropertyCacheService.getProperty( contextObjectUid, allocationIndicationMissingInSource );
        if( _.find( missingInSrc.missingInSrc, object => object.uid === vmo.uid ) ) {
            indicationMatchType = 'MISSING_IN_SOURCE';
        }
    }

    const isClickable = ![ 'OUTOFSCOPE_SINGLE_MATCH', 'OUTOFSCOPE_MULTIPLE_MATCH', 'MISSING_IN_SOURCE' ].includes( indicationMatchType );
    if( indicationMatchType ) {
        const imageSrc = structureType === epBvrConstants.MFG_PRODUCT_BOP ? sourceIndicationsRenderData[ indicationMatchType ][ 0 ] :
            targetIndicationsRenderData[ indicationMatchType ][ 0 ];
        const props = {
            imageSrc,
            tooltipView: TOOLTIP_VIEW,
            tooltipData: getTooltipData( indicationMatchType, mixed, structureType, scopeName ),
            isClickable
        };
        const imageElement = includeComponent( TABLE_CELL_IMAGE_VIEW, props );
        if( isClickable ) {
            // add click handler - not for missing in source or out of scope
            containerElement.addEventListener( 'click', () => {
                eventBus.publish( EP_ALLOCATION_INDICATION_ON_CLICK_EVENT, {
                    contextObject: {
                        indicationMatchType,
                        reference: containerElement,
                        popupReferenceElement: containerElement.parentElement,
                        nodeToFindId: vmo.uid,
                        structureType
                    }
                } );
            }, false );
        }
        renderComponent( imageElement, containerElement );
    }
}

/**
 * Render Allocation Indication on cell.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
function rendererAllocationIndicationForProductBop( vmo, containerElement ) {
    rendererForAllocationIndication( vmo, containerElement, epBvrConstants.MFG_PRODUCT_BOP );
}

/**
 * Render Allocation Indication on cell.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
function rendererAllocationIndicationForPlantBop( vmo, containerElement ) {
    rendererForAllocationIndication( vmo, containerElement, epBvrConstants.MFG_PLANT_BOP );
}

/**
 * show Tooltip On Hover Of Cell Icon.
 *
 * @param { Object } matchType - the match type
 * @param { Boolean } mixed - mixed in scope and out of scope
 * @param {String} structureType: PlantBOP/ProductBOP
 * @param {String} scopeName: loaded scope name
 * @returns {Object} tooltip data
 */
function getTooltipData( matchType, mixed, structureType, scopeName ) {
    let title = '';
    let instruction = '';
    let messages = [];
    if( matchType ) {
        const textMap = structureType === epBvrConstants.MFG_PRODUCT_BOP ? sourceIndicationsRenderData : targetIndicationsRenderData;
        title = localizedMsgs[ textMap[ matchType ][ 1 ] ];
        if( localizedMsgs[ textMap[ matchType ][ 2 ] ] ) {
            messages.push( localizedMsgs[ textMap[ matchType ][ 2 ] ].format( scopeName ) );
        }
        mixed && messages.push( localizedMsgs.multipleMatchWithOutOfScopeMixedText );
        instruction = localizedMsgs[ textMap[ matchType ][ 3 ] ];
    }
    return {
        extendedTooltip: {
            title,
            messages,
            instruction
        }
    };
}

/**
 * This method Process relatedObjectsMap response and update it in property cache for AllocationIndication
 * @param { Object } relatedObjectsMap: SOA call response
 */
function processAllocationIndicationLoadResponseAndUpdateCache( relatedObjectsMap ) {
    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    const objectToParentStationMap = {};
    const sourceToTargetMap = {};
    const targetToSourceMap = {};
    _.forEach( relatedObjectsMap, ( data, uid ) => {
        if( uid === AC_COMPARE_PROPERTIES ) {
            epObjectPropertyCacheService.setProperty( contextObjectUid, AC_COMPARE_PROPERTIES, data.additionalPropertiesMap2.Mfg0properties );
        } else if( data.additionalPropertiesMap2[ epLoadConstants.MISSING_IN_SOURCE ] ) {
            getMissingInSourceItems( data.additionalPropertiesMap2[ epLoadConstants.MISSING_IN_SOURCE ], contextObjectUid );
        } else if( data.additionalPropertiesMap2.bl_parent ) {
            // plant bop object
            objectToParentStationMap[ uid ] = data.additionalPropertiesMap2.bl_parent[ 0 ];
        } else if( data.additionalPropertiesMap2.matchType ) {
            // product bop object
            const matchTypeString = data.additionalPropertiesMap2.matchType[ 0 ];
            const matchTypeNumber = parseInt( matchTypeString );
            if( matchTypeNumber in epLoadConstants.ALLOCATION_INDICATION_RESPONSE_MAP ) {
                let matchType = epLoadConstants.ALLOCATION_INDICATION_RESPONSE_MAP[ matchTypeNumber ];
                const targets = data.additionalPropertiesMap2[ matchTypeString ];
                // matchType = calculateOutOfScope(matchType, targets);
                sourceToTargetMap[ uid ] = { matchType, targets };
                _.forEach( targets, target => {
                    targetToSourceMap[ target ] = { matchType, source: uid };
                } );
            }
        }
    } );

    calculateOutOfScopeAllocations( sourceToTargetMap, objectToParentStationMap );

    epObjectPropertyCacheService.setProperty( contextObjectUid, allocationIndicationSourceToTarget, sourceToTargetMap );
    epObjectPropertyCacheService.setProperty( contextObjectUid, allocationIndicationTargetToSource, targetToSourceMap );
    epObjectPropertyCacheService.setProperty( contextObjectUid, allocationIndicationObjectToParentStation, objectToParentStationMap );
}

/**
 * getStationInScope
 * @param {*} stationUid station uid
 * @returns {Object} station or undefined
 */
function getStationInScope( stationUid ) {
    return _.find( balancingStations, station => station.uid === stationUid );
}

/**
 * calculateOutOfScopeAllocations
 * @param {*} sourceToTargetMap source to target with match type
 * @param {*} objectToParentStationMap target to parent map
 */
function calculateOutOfScopeAllocations( sourceToTargetMap, objectToParentStationMap ) {
    _.forEach( sourceToTargetMap, ( data ) => {
        const parentStations = _.map( data.targets, target => getStationInScope( objectToParentStationMap[ target ] ) );
        if( _.every( parentStations, parentStation => parentStation === undefined ) ) {
            if( data.matchType === 'SINGLE_MATCH' || data.matchType === 'PARTIAL_SINGLE_MATCH' ) {
                data.matchType = 'OUTOFSCOPE_SINGLE_MATCH';
            } else {
                data.matchType = 'OUTOFSCOPE_MULTIPLE_MATCH';
            }
        } else if( ( data.matchType === 'MULTIPLE_MATCH' || data.matchType === 'PARTIAL_MULTIPLE_MATCH' ) &&
            _.some( parentStations, parentStation => parentStation === undefined ) ) {
            data.mixed = true;
        }
    } );
}

/**
 * setBalancingStations
 * @param {Object} balancingData balancingData
 */
function setBalancingStations( balancingData ) {
    balancingStations = balancingData.balancingStations;
}

/**
 * Generate VMO for missing in source
 * @param {Array} missingSrc data
 * @param {String} contextObjectUid uid of the balancing scope
 */
function getMissingInSourceItems( missingSrc, contextObjectUid ) {
    const missingInSourceObjects = _.map( missingSrc, ( uid ) => cdm.getObject( uid ) );
    const missingInSrc = _.concat( ..._.map( balancingStations, station =>
        missingInSourceObjects.filter( source => source.props.bl_parent.dbValues[ 0 ] === station.uid ) ) );
    epObjectPropertyCacheService.setProperty( contextObjectUid, allocationIndicationMissingInSource, { missingInSrc } );
}

/**
 * getSourceForTarget
 * @param {String} target target uid
 * @returns {String} source uid
 */
function getSourceForTarget( target ) {
    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    const matchData = epObjectPropertyCacheService.getProperty( contextObjectUid, allocationIndicationTargetToSource );
    return matchData[ target ].source;
}

/**
 * getSourceForTarget
 * @param {String} source source uid
 * @returns {Array} array of targets
 */
function getTargetsForSource( source ) {
    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    const matchData = epObjectPropertyCacheService.getProperty( contextObjectUid, allocationIndicationSourceToTarget );
    return matchData[ source ].targets;
}

/**
 * getTargetsWithParentsForSource
 * @param {String} source source uid
 * @returns {Array} array of targets
 */
function getTargetsWithParentsForSource( source ) {
    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    const parentsData = epObjectPropertyCacheService.getProperty( contextObjectUid, allocationIndicationObjectToParentStation );
    return _.map( getTargetsForSource( source ), target => ( { target, parent: parentsData[ target ] } ) );
}

/**
 * Returns list of In and out of scope objects when a map of stations is given
 * @param {Map} targetObjects map of target object(operation uid) with the parent details
 * @returns {Object} which contains in scope and out of scope target station from Plant BOP
 */
function findInAndOutOfScopeObjects( targetObjects ) {
    let inScope = [];
    let outOfScope = [];
    let outOfScopeCount = 0;
    targetObjects.forEach( ( targetInfo ) => {
        let vmo = getStationInScope( targetInfo.parent );
        if( vmo ) {
            inScope.push( {
                vmo,
                additionalData: {
                    operation: targetInfo.target
                }
            } );
        } else {
            outOfScopeCount += 1;
        }
    } );
    if( outOfScopeCount > 0 ) {
        const localTextBundle = localeService.getLoadedText( 'allocationIndicationMessages' );
        const outOfScopeText = localTextBundle.outOfScopeMessage.format( outOfScopeCount );
        outOfScope.push( {
            displayName: outOfScopeText
        } );
    }
    return { inScope, outOfScope };
}

/**
 * Returns list of In and out of scope objects when a map of stations is given
 * @param {String} source map of target object(operation uid) with the parent details
 * @param {Object} balancingData balancingData
 */
function findInPlantBOP( source, balancingData ) {
    const targetParents = getTargetsWithParentsForSource( source );
    const foundStation = getStationInScope( targetParents[ 0 ].parent );
    if( foundStation ) {
        const targetOperation = cdm.getObject( targetParents[ 0 ].target );
        updateSelectionForFindIn( balancingData, foundStation, targetOperation );
    }
}

/**
 * findMissingInSourceInPlantBOP
 * @param {ViewModelObject} missingInSourceObject missing in source object
 * @param {Object} balancingData balancingData
 */
function findMissingInSourceInPlantBOP( missingInSourceObject, balancingData ) {
    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    const parentsData = epObjectPropertyCacheService.getProperty( contextObjectUid, allocationIndicationObjectToParentStation );
    const stationUid = parentsData[ missingInSourceObject.uid ];
    if( stationUid ) {
        const foundStation = getStationInScope( stationUid );
        if( foundStation ) {
            updateSelectionForFindIn( balancingData, foundStation, missingInSourceObject );
        }
    }
}

/**
 *
 * @param {Object} inputObject input object
 * @param {Object} balancingData balancingData
 */
function findInPlantBOPFromAssignmentList( inputObject, balancingData ) {
    if( inputObject && inputObject !== '' ) {
        const targetParentStation = inputObject.vmo ? inputObject.vmo : inputObject;
        let targetOperation;
        if( inputObject.additionalData && inputObject.additionalData.operation ) {
            targetOperation = cdm.getObject( inputObject.additionalData.operation );
        }
        updateSelectionForFindIn( balancingData, targetParentStation, targetOperation );
    }
}

/**
 * updateSelectionForFindIn
 * @param {Object} balancingData balancingData
 * @param {Object} station target station
 * @param {Object} operation target operation
 */
function updateSelectionForFindIn( balancingData, station, operation ) {
    const updatedBalancingData = { ...balancingData.getValue() };
    if( balancingData.selectionData.station && station.uid === balancingData.selectionData.station.uid ) {
        updatedBalancingData.selectionData.operation = operation;
    } else {
        updatedBalancingData.selectionData.pendingOperation = operation;
    }
    updatedBalancingData.selectionData.station = station;
    updatedBalancingData.selectionData.processResource = null;
    balancingData.update( updatedBalancingData );
}

/**
 * destroy
 */
function destroy() {
    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    epObjectPropertyCacheService.clearPropertyKeyCache( contextObjectUid, allocationIndicationObjectToParentStation );
    epObjectPropertyCacheService.clearPropertyKeyCache( contextObjectUid, allocationIndicationSourceToTarget );
    epObjectPropertyCacheService.clearPropertyKeyCache( contextObjectUid, allocationIndicationTargetToSource );
    epObjectPropertyCacheService.clearPropertyKeyCache( contextObjectUid, allocationIndicationMissingInSource );
    epObjectPropertyCacheService.clearPropertyKeyCache( contextObjectUid, AC_COMPARE_PROPERTIES );

    epReloadService.unregisterReloadInput( ALLOCATION_INDICATION_RELOAD );
    balancingStations = [];
}

/**
 * registerReload
 * @param {*} checkType ac type
 * @param {*} currentScope process area
 * @param {*} sourceObject product bop
 * @param {*} targetObject plant bop
 */
export function registerReload( checkType, currentScope, sourceObject, targetObject ) {
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
            attributeValue: targetObject
        }
        ];

        epReloadService.registerReloadInput( ALLOCATION_INDICATION_RELOAD, {
            reloadTypeName: 'AccountabilityCheck',
            additionalLoadParams
        } );
    }
}

/**
 * updateAccountabilityResponseCache
 * @param {*} saveEvents saveEvents
 */
export function updateAccountabilityResponseCache( saveEvents ) {
    const { missingInSource, allocated, notAllocated } = saveEvents;

    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    let objectToParentStationMap = epObjectPropertyCacheService.getProperty( contextObjectUid, allocationIndicationObjectToParentStation );
    let sourceToTargetMap = epObjectPropertyCacheService.getProperty( contextObjectUid, allocationIndicationSourceToTarget );
    let targetToSourceMap = epObjectPropertyCacheService.getProperty( contextObjectUid, allocationIndicationTargetToSource );

    // missing in source
    getMissingInSourceItems( _.map( missingInSource, missingInSourceEvent => missingInSourceEvent.eventObjectUid ), contextObjectUid );

    // not allocated
    _.forEach( notAllocated, notAllocatedEvent => {
        const source = notAllocatedEvent.eventObjectUid;
        // if it was allocated before - remove from maps
        if( sourceToTargetMap[ source ] ) {
            // remove targets from targets map
            const targets = sourceToTargetMap[ source ].targets;
            targetToSourceMap = _.omit( targetToSourceMap, targets );
            objectToParentStationMap = _.omit( objectToParentStationMap, targets );
        }
        // remove source
        sourceToTargetMap = _.omit( sourceToTargetMap, [ source ] );
    } );

    // allocated
    _.forEach( allocated, allocatedEvent => {
        const source = allocatedEvent.eventObjectUid;
        const matchTypeNumber = parseInt( allocatedEvent.eventData[ 0 ] );
        const matchType = epLoadConstants.ALLOCATION_INDICATION_RESPONSE_MAP[ matchTypeNumber ];
        allocatedEvent.eventData.shift();
        const targets = allocatedEvent.eventData;
        sourceToTargetMap[ source ] = { matchType, targets };

        _.forEach( sourceToTargetMap[ source ].targets, target => {
            if( !objectToParentStationMap[ target ] ) {
                const object = cdm.getObject( target );
                objectToParentStationMap[ target ] = object.props.bl_parent.dbValues[ 0 ];
            }
            targetToSourceMap[ target ] = { matchType, source };
        } );
    } );

    calculateOutOfScopeAllocations( sourceToTargetMap, objectToParentStationMap );

    epObjectPropertyCacheService.setProperty( contextObjectUid, allocationIndicationSourceToTarget, sourceToTargetMap );
    epObjectPropertyCacheService.setProperty( contextObjectUid, allocationIndicationTargetToSource, targetToSourceMap );
    epObjectPropertyCacheService.setProperty( contextObjectUid, allocationIndicationObjectToParentStation, objectToParentStationMap );
}

/**
 * getCompareProperties
 * @returns {Array} AC_COMPARE_PROPERTIES
 */
export function getCompareProperties() {
    const contextObjectUid = epContextService.getPageContext().loadedObject.uid;
    return epObjectPropertyCacheService.getProperty( contextObjectUid, AC_COMPARE_PROPERTIES );
}

export default {
    processAllocationIndicationLoadResponseAndUpdateCache,
    renderIndicationColumnHeader,
    setBalancingStations,
    rendererAllocationIndicationForProductBop,
    rendererAllocationIndicationForPlantBop,
    getSourceForTarget,
    getTargetsForSource,
    getTargetsWithParentsForSource,
    findInAndOutOfScopeObjects,
    findInPlantBOP,
    findMissingInSourceInPlantBOP,
    findInPlantBOPFromAssignmentList,
    destroy,
    registerReload,
    updateAccountabilityResponseCache,
    getCompareProperties
};
