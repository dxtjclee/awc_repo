// Copyright (c) 2023 Siemens

/**
 * Service Plan PERT functions
 *
 * @module js/ssp0PertGraphDataProviderService
 */

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';
import eventBus from 'js/eventBus';
import appCtxService from 'js/appCtxService';

var exports = {};


export const updatePertDataProvider = function( selectedVMO ) {
    let instance = AwPromiseService.instance;
    let deferred = AwPromiseService.instance.defer();
    const promiseAll = [];
    const graphNodeUids = [];

    //create all of the relevant nodes
    selectedVMO.props.me_cl_child_lines.dbValues.forEach( children => graphNodeUids.push( children ) );

    if( graphNodeUids ) {
        graphNodeUids.forEach( function( uid ) {
            let modelObj = cdm.getObject( uid );
            if( modelObj.modelType.typeHierarchyArray.includes( 'CfgActivityLine' ) ) {
                let promise = mfeVMOService.createViewModelObjectFromModelObject( modelObj );
                promiseAll.push( promise );
            }
        } );
    }

    return instance.all( promiseAll );
};
/**
 * Load graph data after graph is initialized.
 * @param {*} graphModel graphModel
 * @param {*} subPanelContext subPanelContext
 */
export const loadGraphData = function( graphModel, selectedVMO ) {
    // selectedVMO = selectedVMO[0];
    updatePertDataProvider( selectedVMO ).then( function( res ) {
        const pertData = {
            nodes: [],
            edges: [],
            ports: []
        };
        pertData.nodes = Object.assign( pertData.nodes, res );
        eventBus.publish( graphModel.graphDataProvider.name + '.graphDataLoaded', { graphData: pertData } );
    } );
};

export default exports = {
    loadGraphData
};
