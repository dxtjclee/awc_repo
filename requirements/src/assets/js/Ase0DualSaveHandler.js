// Copyright (c) 2022 Siemens

/**
 * Module for the Requirements Page
 *
 * @module js/Ase0DualSaveHandler
 */
import AwPromiseService from 'js/awPromiseService';
import dms from 'soa/dataManagementService';
import soaSvc from 'soa/kernel/soaService';
import declUtils from 'js/declUtils';

var exports = {};
var saveHandler = {};

var _reqDocSvc = null;
var _deferred = null;

/**
 * Get save handler.
 *
 * @returns {Object}  Save Handler
 */
export let getSaveHandler = function() {
    if( _reqDocSvc === null || _reqDocSvc === null ) {
        _deferred = AwPromiseService.instance.defer();

        var depModules = [];
        depModules.push( 'js/Arm0RequirementDocumentation' );

        declUtils.loadDependentModules( depModules ).then(
            function( depModuleObj ) {
                _reqDocSvc = depModuleObj && depModuleObj.Arm0RequirementDocumentation;
                _deferred.resolve();
            }
        );
    }

    return saveHandler;
};

/**
 * custom save handler save edits called by framework. The handler resolves the promise only
 * after the document & table save operations are completed.
 *
 * @return {promise} resolved or rejected based on table & document save results
 */
saveHandler.saveEdits = function( dataSource, inputs ) {
    var _deferredSave = AwPromiseService.instance.defer();

    _deferred.promise.then(
        function() {
            var reqSave = _reqDocSvc.getSaveHandler();
            var _reqDocDirty = false;
            var _docPromise = null;
            var _attrPromise = null;
            var _isReqDocSaveEditsCalled = false;

            try {
                _reqDocDirty = reqSave.isDirty( dataSource );
            } catch ( e ) {
                _reqDocDirty = false;
            }

            if( _reqDocDirty ) {
                _docPromise = reqSave.saveEdits( dataSource, inputs );
                _isReqDocSaveEditsCalled = true;
            } else {
                var _docDefer = AwPromiseService.instance.defer();
                _docPromise = _docDefer.promise;
                _docDefer.resolve();
            }

            // No need to call saveViewModelEditAndSubmitWorkflow if saveEdits for req doc gets called,
            // as it is responsible to call saveViewModelEditAndSubmitWorkflow for table/properties save operations
            if( !_isReqDocSaveEditsCalled && inputs.length > 0 ) {
                dataSource.registerPropPolicy();
                _attrPromise = dms.saveViewModelEditAndSubmitWorkflow( inputs );
            } else {
                var _attrDefer = AwPromiseService.instance.defer();
                _attrPromise = _attrDefer.promise;
                _attrDefer.resolve();
            }

            _docPromise.then( function() {
                _attrPromise.then( function( response ) {
                    var _error = null;
                    if( response ) {
                        dataSource.unregisterPropPolicy();

                        if( response.partialErrors || response.PartialErrors ) {
                            _error = soaSvc.createError( response );
                        } else if( response.ServiceData && response.ServiceData.partialErrors ) {
                            _error = soaSvc.createError( response.ServiceData );
                        }
                    }
                    if( _error ) {
                        _deferredSave.reject( _error );
                    } else {
                        _deferredSave.resolve( response );
                    }
                },
                function( err ) {
                    _deferredSave.reject( err );
                } );
            },
            function( err ) {
                _deferredSave.reject( err );
            } );
        }
    );
    return _deferredSave.promise;
};

saveHandler.isDirty = function( dataSource ) {
    if( _reqDocSvc === null ) {
        return AwPromiseService.instance.when( true );
    }

    var reqSave = _reqDocSvc.getSaveHandler();
    var _reqDocDirty = false;

    try {
        _reqDocDirty = reqSave.isDirty( dataSource );
    } catch ( e ) {
        _reqDocDirty = false;
    }

    if( _reqDocDirty ) {
        return AwPromiseService.instance.when( true );
    }

    var _modProps = dataSource.getAllModifiedProperties();

    if( _modProps && _modProps.length > 0 ) {
        return AwPromiseService.instance.when( true );
    }
    return AwPromiseService.instance.when( false );
};

export default exports = {
    getSaveHandler
};
