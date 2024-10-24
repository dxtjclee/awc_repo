// Copyright (c) 2022 Siemens

/**
 * This is a helper class for the Audit Norm Selection
 *
 * @module js/qa0AuditNormSelectionService
 */
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import dms from 'soa/dataManagementService';
import editHandlerService from 'js/editHandlerService';
import soaSvc from 'soa/kernel/soaService';
import cdmService from 'soa/kernel/clientDataModel';

var exports = {};

/**
  * Initialize audit norm value list from assigned audit guideline object.
  * @param {object} subPanelContext - parent context
 */
var loadAssociatedLOVValues = function( subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();
    var initialData = {
        initialData: {
            lovInput: {
                operationName: 'Create',
                boName: 'Qa0QualityAudit'
            },
            propertyName: 'qa0AuditNorms'
        }
    };
    // Retrieve Qa0AuditNorms LOV
    soaSvc.post( 'Core-2013-05-LOV', 'getInitialLOVValues', initialData ).then( function( responseData ) {
        var lovEntries = [];
        var lovInput = responseData.lovValues;       

        var guidelineNorms;

        if(subPanelContext.selected.type==='Qa0QualityAudit'){
            var guidelineUID = subPanelContext.selected.props.qa0AuditGuideline.dbValues[0];
            // Retrieve allowed norms from assigned guideline object
            let guidelineObj = cdmService.getObject( guidelineUID );
            guidelineNorms = guidelineObj.props.qa0AuditNorms;
            // Only show norms, that are assigned to the current guideline object and
            // don't already exist in the qa0AuditNorms property
           
        }

        for( let i = 0; i < lovInput.length; i++ ) {
            var internalValue = lovInput[ i ].propInternalValues.lov_values[ 0 ];
            var displayValue = lovInput[ i ].propDisplayValues.lov_values[ 0 ];
            var displayDescription = '';

            if ( lovInput[ i ].propDisplayValues.lov_value_descriptions ) {
                displayDescription = lovInput[ i ].propDisplayValues.lov_value_descriptions[ 0 ];
            }
    
            if( subPanelContext.selected.type==='Qa0QualityAudit' && guidelineNorms && _.includes( guidelineNorms.dbValues, internalValue ) ) {
                lovEntries.push( {
                    propDisplayValue: displayValue,
                    propInternalValue: internalValue,
                    propDisplayDescription: displayDescription,
                    hasChildren: false,
                    children: {},
                    sel: false
                } );
            } 
        }
        return deferred.resolve( lovEntries );
    } );
    return deferred.promise;
};

export let loadAndBindProperty = function( subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();
    var selectedObject = subPanelContext.selected;
    var requiredPropsListOfList = [
        [ selectedObject.props.qa0AuditNorms, 'qa0AuditNorms' ]
    ];

    var propsToLoad = [];
    _.forEach( requiredPropsListOfList, function( prop ) {
        if ( !prop[0] ) {
            propsToLoad.push( prop[1] );
        }
    } );

    var uid = [ selectedObject.uid ];
    if ( propsToLoad.length > 0 ) {
        dms.getProperties( uid, propsToLoad )
            .then(
                function() {
                    deferred.resolve( bindProperties( subPanelContext ) );
                }
            );
    } else {
        deferred.resolve( bindProperties( subPanelContext ) );
    }
    return deferred.promise;
};

export let bindProperties = function( subPanelContext ) {
    if (subPanelContext.xrtState.value.xrtVMO.props.qa0AuditNorms)
    {
        let newQa0AuditNorms = subPanelContext.xrtState.value.xrtVMO.props.qa0AuditNorms;
        newQa0AuditNorms.isArray = true;
        newQa0AuditNorms.hasLov = true;
        newQa0AuditNorms.isEditable = false;
        newQa0AuditNorms.dataProvider = 'AuditNormProvider';
        newQa0AuditNorms.type = 'STRINGARRAY';    
        newQa0AuditNorms.renderingHint= "checkboxoptionlov";

        return newQa0AuditNorms;
    }else {
        return null;
    }
};

export let auditNormEditStateChanger = function( subPanelContext, data ) {
    var deferred = AwPromiseService.instance.defer();
    var activeEditHandler = editHandlerService.getActiveEditHandler();    
    if ( activeEditHandler ) {
        if ( activeEditHandler.editInProgress() ) {
            let newQa0AuditNorms = data.qa0AuditNorms; 
             // set property object's isEditable property.
            newQa0AuditNorms.isEditable = activeEditHandler.editInProgress();
            newQa0AuditNorms.sourceObjectLastSavedDate = subPanelContext.selected.props.last_mod_date.dbValues[0];           
            // load LOV Values
            loadAssociatedLOVValues( subPanelContext ).then( function(response) {
                deferred.resolve({
                    genericAuditNorms: response,
                    qa0AuditNorms: newQa0AuditNorms
                });
            });
        } else {    
            
            let newQa0AuditNorms = bindProperties(subPanelContext);            
            deferred.resolve({
                genericAuditNorms: data.dataProviders.AuditNormProvider.viewModelCollection.loadedVMObjects,
                qa0AuditNorms: newQa0AuditNorms
            });
        }
    }
    return deferred.promise;
};


export let auditNormChangeAction = function( subPanelContext, data ) {
    var deferred = AwPromiseService.instance.defer();
    let newQa0AuditNorms = data.qa0AuditNorms;    
    newQa0AuditNorms.sourceObjectLastSavedDate = subPanelContext.selected.props.last_mod_date.dbValues[0];

    // update audit norm LOV Values
    loadAssociatedLOVValues( subPanelContext ).then( function(response) {
        deferred.resolve({
            genericAuditNorms: response,
            qa0AuditNorms: newQa0AuditNorms
        });
    });

    return deferred.promise;
};

export default exports = {
    auditNormEditStateChanger,
    auditNormChangeAction,
    bindProperties,
    loadAndBindProperty
};
