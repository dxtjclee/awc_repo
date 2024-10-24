// Copyright (c) 2022 Siemens

/**
 * @module js/tq0AssignWorkflowTemplate
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import _ from 'lodash';

/**
 * Define public API
 */
var exports = {};

/**
* This method gets all the workflow templates
* @param {data} data - The qualified data of the viewModel
*/
export let getWorkflowTemplateVMOs = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var getTemplatesInput = [];

    var allInputInternal = {
        clientId: 'allTemplates',
        getFiltered: false
    };

    getTemplatesInput.push( allInputInternal );

    var policy = {
        types: [ {
            name: 'EPMTaskTemplate',
            properties: [ {
                name: 'template_name'
            },
            {
                name: 'fnd0origin_uid'
            }
            ]
        } ]
    };

    policySvc.register( policy );
    var inputData = {};
    inputData.input = getTemplatesInput;
    soaService.post( 'Workflow-2013-05-Workflow', 'getWorkflowTemplates', inputData ).then( function( response ) {
        if( policy ) {
            policySvc.unregister( policy );
        }

        var output = response.templatesOutput[0].workflowTemplates;
        var allWorkflowTemplateObjs = [];

        _.forEach( output, function( object ) {
            const vmo = viewModelObjectService.constructViewModelObjectFromModelObject( object );
            allWorkflowTemplateObjs.push( vmo );
        } );

        var filteredWorkflowTemplates = [];
        var responseData = {};
        if( data.filterBox.dbValue ) {
            var filterData = data.filterBox.dbValue;
            var re = new RegExp( filterData, 'gi' );
            _.forEach( allWorkflowTemplateObjs, function( obj ) {
                var tempName = obj.props.template_name.dbValues[0];
                var res =  tempName.match( re );
                if( res ) { filteredWorkflowTemplates.push( obj ); }
            } );
            responseData = {
                searchResults : filteredWorkflowTemplates
            };
        } else {
            responseData = {
                searchResults : allWorkflowTemplateObjs
            };
        }
        deferred.resolve( responseData );
    }, function( reason ) {
        deferred.reject( reason );
    } );
    return deferred.promise;
};

/**
 * prepare the input for set properties SOA call to add the QR Workflow Template
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} ctx - The data provider that will be used to get the correct content
 */

export let addWorkflowTemplate = function( data, ctx ) {
    var inputData = [];

    var selected = ctx.mselected;

    selected.forEach( function( selectedTask ) {
        var infoObj = {};

        infoObj.object = cdm.getObject( selectedTask.uid );
        infoObj.timestamp = '';

        var temp = {};

        temp.name = 'tq0QRWorkflowTemplate';
        temp.values = [ data.dataProviders.getWorkflowTemplatesList.selectedObjects[0].props.fnd0origin_uid.dbValues[0] ];

        var vecNameVal = [];
        vecNameVal.push( temp );

        infoObj.vecNameVal = vecNameVal;

        inputData.push( infoObj );
    } );

    return inputData;
};

export default exports = {
    getWorkflowTemplateVMOs,
    addWorkflowTemplate
};
