// Copyright (c) 2022 Siemens

import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import { getBaseUrlPath } from 'app';
import vmoSvc from 'js/viewModelObjectService';
import localeSvc from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import _ from 'lodash';

/**
 * NGP Assignments mismatch or missing service
 *
 * @module js/services/ngpAssignmentMismatchOrMissingService
 */

const localizedMsgs = localeSvc.getLoadedText( 'NgpProductAssignmentsMessages' );
export const PROPERTY_NAMES = {
    PLAN_ELEMENT_MISMATCH_PROPERTY: 'mismatchOrMissing',
    DESIGN_ELEMENT_OR_FEATURE_MISMATCH_PROP: 'MismatchStatus',
    DESIGN_ELEMENT_OR_FEATURE_MISSING_PROP: 'MissingInSource'
};
const MISMATCH_IN_CURRENT_SCOPE = 'MismatchAtActivityLevel';
const MISMATCH_IN_CURRENT_SCOPE_DF = 'MismatchAtActivityLevelDF';
const MISSING_IN_CURRENT_SCOPE = 'MissignInSourceAtActivityLevel';
const MISSING_IN_CURRENT_SCOPE_DF = 'MissignInSourceAtActivityLevelDF';
const MISMATCH_IN_INNER_SCOPE = 'MismatchAtProcessLevel';
const MISSING_IN_INNER_SCOPE = 'MissignInSourceAtProcessLevel';
const FALSE_POSITIVE_MIMSATCH = 'FalsePositive';
const PLAN_ELEMENT_MISMATCH_STATUSES = [ {
    names: [ MISMATCH_IN_CURRENT_SCOPE, MISMATCH_IN_CURRENT_SCOPE_DF, MISSING_IN_CURRENT_SCOPE, MISSING_IN_CURRENT_SCOPE_DF ],
    image: 'indicatorMismatch16.svg',
    tooltipView: 'MfeGenericTooltip',
    processTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.containsMismatchTooltipTitle,
            messages: [ localizedMsgs.containsMismatchTooltipMsgsForProcess ]
        }
    },
    operationTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.containsMismatchTooltipTitle,
            messages: [ localizedMsgs.containsMismatchTooltipMsgsForOperation ]
        }
    }
},
{
    names: [ MISMATCH_IN_INNER_SCOPE, MISSING_IN_INNER_SCOPE ],
    image: 'indicatorContainsInnerMismatches16.svg',
    tooltipView: 'MfeGenericTooltip',
    processTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.containsInnerMismatchesTooltipTitle,
            messages: [ localizedMsgs.containsInnerMismatchesTooltipMsgsForProcess ]
        }
    }
}
];
const DESIGN_ELEMENT_OR_FEATURE_MISMATCH_STATUSES = [ {
    names: [ MISMATCH_IN_CURRENT_SCOPE ],
    image: 'indicatorMismatch16.svg',
    tooltipView: 'MfeGenericTooltip',
    assigedToProcessTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.mismatchTooltipTitle,
            messages: [ localizedMsgs.mismatchInSubsetTooltipMsg ],
            instruction: localizedMsgs.clickForMoreOptions
        }
    },
    assigedToOperationTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.mismatchTooltipTitle,
            messages: [ localizedMsgs.mismatchInProcessTooltipMsg ],
            instruction: localizedMsgs.clickForMoreOptions
        }
    }
},
{
    names: [ MISSING_IN_CURRENT_SCOPE ],
    image: 'indicatorMissingInSource16.svg',
    tooltipView: 'MfeGenericTooltip',
    assigedToProcessTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.missingInSubsetTooltipTitle
        }
    },
    assigedToOperationTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.missingInProcessTooltipTitle
        }
    }
},
{
    names: [ FALSE_POSITIVE_MIMSATCH ],
    image: 'indicatorRevisedNotChanged16.svg',
    tooltipView: 'MfeGenericTooltip',
    assigedToProcessTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.falsePositiveTooltipTitle,
            messages: [ localizedMsgs.falsePositiveInSubsetTooltipMsg ],
            instruction: localizedMsgs.clickForMoreOptions
        }
    },
    assigedToOperationTooltipData: {
        extendedTooltip: {
            title: localizedMsgs.falsePositiveTooltipTitle,
            messages: [ localizedMsgs.falsePositiveInProcessTooltipMsg ],
            instruction: localizedMsgs.clickForMoreOptions
        }
    }
}
];

/**
 *
 * @param {viewModelObject} vmo - a given viewMOdelObject
 * @param {string[]} mismatchOrMissingStatuses - the mismatch statuses of the given vmo
 */
export function createMismatchOrMissingProperty( vmo, mismatchOrMissingStatuses ) {
    const mismatchOrMissingPropObj = {
        value: mismatchOrMissingStatuses,
        displayValue: mismatchOrMissingStatuses,
        propType: 'STRINGARRAY',
        isArray: true,
        isModifiable: false,
        isEditable: false,
        isEnabled: false
    };
    vmo.props[ PROPERTY_NAMES.PLAN_ELEMENT_MISMATCH_PROPERTY ] = vmoSvc.constructViewModelProperty( mismatchOrMissingPropObj, PROPERTY_NAMES.PLAN_ELEMENT_MISMATCH_PROPERTY, vmo, false );
}

/**
 *
 * @param {viewModelObject} vmo - a given viewMOdelObject
 * @param {DOMElement} containerElement - the dom element which will contain the rendered element
 */
export function renderProcessOrOperationMismatchCellImage( vmo, containerElement ) {
    const status = getPlanElementMismatchStatusObject( vmo );
    if( status ) {
        const props = {
            imageSrc: `${getBaseUrlPath()}/image/${status.image}`,
            tooltipView: status.tooltipView,
            tooltipData: ngpTypeUtils.isProcessElement( vmo ) ? status.processTooltipData : status.operationTooltipData
        };
        let cellElement = includeComponent( 'MfeTableCellImage', props );
        renderComponent( cellElement, containerElement );
    }
}

/**
 *
 * @param {viewModelObject} vmo - a given viewMOdelObject
 * @returns {object} the status object based on the vmo prop value
 */
function getPlanElementMismatchStatusObject( vmo ) {
    const mismatchStatus = vmo.props[ PROPERTY_NAMES.PLAN_ELEMENT_MISMATCH_PROPERTY ].dbValues;
    if( Array.isArray( mismatchStatus ) && mismatchStatus.length > 0 ) {
        for( let assignedToStatus of PLAN_ELEMENT_MISMATCH_STATUSES ) {
            const sharedValues = mismatchStatus.filter( ( status ) => assignedToStatus.names.indexOf( status ) > -1 );
            if( sharedValues.length > 0 ) {
                return assignedToStatus;
            }
        }
    }
}

/**
 *
 * @param {viewModelObject} vmo - a given vmo
 * @returns {object} the status object if found
 */
function getDesignElementOrFeatureMismatchStatusObject( vmo ) {
    const mismatchStatus = vmo.props[ PROPERTY_NAMES.DESIGN_ELEMENT_OR_FEATURE_MISMATCH_PROP ].dbValue || vmo.props[ PROPERTY_NAMES.DESIGN_ELEMENT_OR_FEATURE_MISSING_PROP ].dbValue;
    if( mismatchStatus ) {
        return _.find( DESIGN_ELEMENT_OR_FEATURE_MISMATCH_STATUSES, ( status ) => status.names.indexOf( mismatchStatus ) > -1 );
    }
}

/**
 *
 * @param {viewModelObject} vmo - a given vmo
 * @param {DomElement} containerElement the element which contains our rendered object
 */
export function renderDesignElementOrFeatureMismatchCellImage( vmo, containerElement ) {
    const statusObj = getDesignElementOrFeatureMismatchStatusObject( vmo );
    if( statusObj ) {
        const scopeObject = appCtxSvc.getCtx( 'ngp.scopeObject' );
        const props = {
            imageSrc: `${getBaseUrlPath()}/image/${statusObj.image}`,
            tooltipView: statusObj.tooltipView,
            tooltipData: ngpTypeUtils.isActivity( scopeObject ) ? statusObj.assigedToProcessTooltipData : statusObj.assigedToOperationTooltipData
        };
        let cellElement = includeComponent( 'MfeTableCellImage', props );
        renderComponent( cellElement, containerElement );
    }
}

let exports = {};
export default exports = {
    createMismatchOrMissingProperty,
    renderProcessOrOperationMismatchCellImage,
    renderDesignElementOrFeatureMismatchCellImage
};
