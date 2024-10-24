// Copyright (c) 2022 Siemens

/**
 * @module js/prm1ProductAddComparisonService
 */
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import prm1CompareService from 'js/prm1ParameterViewService';
import cmm from 'soa/kernel/clientMetaModel';
import dmSvc from 'soa/dataManagementService';
import soaSvc from 'soa/kernel/soaService';
import AwStateService from 'js/awStateService';
import eventBus from 'js/eventBus';


var exports = {};

/**
 * Ensure parameter compare types are present in cache
 *
 * @param {Object} data - The add VR/study panel's view model object
 *
 */
export let ensureCompareTypesLoadedJs = function( paramCompareViewContext ) {
    var deferred = AwPromiseService.instance.defer();
    var returnedTypes = [];

    var displayableCompareTypes = getApplicableComparisonElements( paramCompareViewContext );


    var promise = soaSvc.ensureModelTypesLoaded( displayableCompareTypes );
    if( promise ) {
        promise.then( function() {
            var typeUids = [];
            for( var i = 0; i < displayableCompareTypes.length; i++ ) {
                var modelType = cmm.getType( displayableCompareTypes[ i ] );
                // If the displayable compare type is not installed, don't add to returnedTypes.
                // We will not show compare type in AW UI if is not installed.
                if( modelType ) {
                    returnedTypes.push( modelType );
                    typeUids.push( modelType.uid );
                }
            }
            //ensure the ImanType objects are loaded
            var policyId = propPolicySvc.register( {
                types: [ {
                    name: 'ImanType',
                    properties: [ {
                        name: 'parent_types'
                    }, {
                        name: 'type_name'
                    } ]
                } ]
            } );

            dmSvc.loadObjects( typeUids ).then( function() {
                var returneddata = {
                    searchResultsType: returnedTypes,
                    totalFoundType: returnedTypes.length
                };

                propPolicySvc.unregister( policyId );

                deferred.resolve( returneddata );
            } );
        } );
    }

    return deferred.promise;
};

/**
 * Method to get excluded Rev Rule uids
 * @param {object} data  view model object
 * @returns {String} excluded Rev Rule uids
 */
export let getExcludedComparisonElements = function() {
    var excludedRevRuleUids = '';
    var separator = prm1CompareService.getSeparator();

    let params = AwStateService.instance.params;
    excludedRevRuleUids = params.curr_rev_uid ? params.curr_rev_uid : '';

    var comparisonElements = params.comp_uids;
    if( comparisonElements ) {
        var elements = comparisonElements.split( separator );
        for( var i = 0; i < elements.length; i++ ) {
            if( i === 0 ) {
                excludedRevRuleUids = elements[ i ];
            } else {
                excludedRevRuleUids = excludedRevRuleUids + separator + elements[ i ];
            }
        }
    }
    return excludedRevRuleUids;
};

/**
 * Method to get the applicable comparison elements for opened Object
 * @returns {Array} the list of displayable comaprison elements
 */
function getApplicableComparisonElements( paramCompareViewContext ) {
    var displayableCompareTypes = [];
    if( paramCompareViewContext && paramCompareViewContext.compareType === 'ProjectParamComparison' ) {
        displayableCompareTypes.push( 'Crt0VldnContract' );
        displayableCompareTypes.push( 'RevisionRule' );
    } else {
        displayableCompareTypes.push( 'Crt0VldnContract' );
        displayableCompareTypes.push( 'Fnd0SearchRecipe' );
        displayableCompareTypes.push( 'RevisionRule' );
    }
    return displayableCompareTypes;
}

/**
 * Clear selected type when user click on type link
 *
 * @param {Object} data - The add VR/study panel's view model object
 *
 */
export let clearSelectedType = function( data ) {
    var selectedType = _.clone( data.selectedType );
    selectedType.dbValue = '';
    selectedType.uiValue = '';
    return {
        selectedType : selectedType
    };
};

/**
 * get selected type display value to show as link
 * @param {Object} data - The add VR/study panel's view model object
 */
export let getSelectedType = function( data ) {
    var selectedType = _.clone( data.selectedType );

    if( data.dataProviders.getParamComparisonTypes.selectedObjects.length > 0 ) {
        selectedType.dbValue = data.dataProviders.getParamComparisonTypes.selectedObjects[ 0 ].props.type_name.dbValues[0];
        selectedType.uiValue = data.dataProviders.getParamComparisonTypes.selectedObjects[ 0 ].props.type_name.uiValue;
    }
    return {
        selectedType : selectedType

    };
};

/**
 * To update the display name of Crt0VldnContract type
 * @param {Object} data - The add VR/study panel's view model object
 */
export let updateVRStudyDisaplyName = function( data ) {
    var isUpdateRequired = false;
    for( var i = 0; i < data.dataProviders.getParamComparisonTypes.viewModelCollection.loadedVMObjects.length; i++ ) {
        if( isVRStudyType( data.dataProviders.getParamComparisonTypes.viewModelCollection.loadedVMObjects[ i ] ) ) {
            var clonedObject = _.clone( data.dataProviders.getParamComparisonTypes.viewModelCollection.loadedVMObjects[ i ] );
            if( clonedObject.props.type_name.uiValue !== data.i18n.VRStudyTypeTitle ) {
                clonedObject.props.type_name.uiValue = data.i18n.VRStudyTypeTitle;
                data.dataProviders.getParamComparisonTypes.viewModelCollection.loadedVMObjects[ i ] = clonedObject;
                isUpdateRequired = true;
            }
        }
    }
    if( isUpdateRequired ) {
        data.dataProviders.getParamComparisonTypes.update( data.dataProviders.getParamComparisonTypes.viewModelCollection.loadedVMObjects );
    }
};

/**
 * Method to check if the VMO is of type Crt0VldnContract
 * @param {ViewModelObject} vmo the view model object
 * @returns {Boolean} true if the VMO is of type Crt0VldnContract otherwise false
 */
function isVRStudyType( vmo ) {
    var props = vmo.props;
    var isVrObject = false;
    if( props && props.type_name && props.type_name.value === 'Crt0VldnContract' ) {
        isVrObject =  true;
    } else {
        var modelType = cmm.getType( vmo.uid );
        isVrObject = modelType !== null && modelType !== undefined && modelType.name === 'Crt0VldnContract';
    }
    return isVrObject;
}

/**
 * Method to get provider name as per type of comparison selected
 * @param {object} data VMO
 * @returns {String} provider name
 */
export let getProviderName = function( data ) {
    var providerName = null;
    //if verification request selected
    if( data.selectedType.dbValue === 'Crt0VldnContract' ) {
        providerName = 'Crt1WhereUsdVRStudyProvider';
    }
    //if Recipe selected
    else if( data.selectedType.dbValue === 'Fnd0SearchRecipe' ) {
        providerName = 'Att1GetRecipesProvider';
    }
    return providerName;
};

/**
 * Method to get comaprison element type as per type of comparison selected
 * @param {object} data VMO
 * @returns {String} provider name
 */
export let getComparisonElementType = function( data ) {
    var comparisionelementtype = null;
    if( data.selectedType.dbValue === 'Crt0VldnContract' ) {
        comparisionelementtype = 'vrAndSimRequest';
    } else if( data.selectedType.dbValue === 'Fnd0SearchRecipe' ) {
        comparisionelementtype = 'recipe';
    } else if( data.selectedType.dbValue === 'RevisionRule' ) {
        comparisionelementtype = 'RevisionRule';
    }
    return comparisionelementtype;
};

/**
  * Method to get the separator to be used
  */
export let getSeparator = function( paramCompareViewContext = {} ) {
    return prm1CompareService.getSeparator( paramCompareViewContext );
};

/**
 * Returns the prm1ProductAddComparisonService instance
 *
 * @member prm1ProductAddComparisonService
 */

export default exports = {
    ensureCompareTypesLoadedJs,
    clearSelectedType,
    getSelectedType,
    updateVRStudyDisaplyName,
    getProviderName,
    getComparisonElementType,
    getExcludedComparisonElements,
    getSeparator
};
