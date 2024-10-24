// Copyright (c) 2022 Siemens

/**
 * @module js/addElementTypeHandler
 */
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import iconService from 'js/iconService';
import cmm from 'soa/kernel/clientMetaModel';
import ckeditorOperations from 'js/ckeditorOperations';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Gets the displayableTypes for given or selected object
 *
 * @param {Object} selectedObject - The Selected object
 * @param {Boolean} createTemplateMap - true, if needs to create Template map for ckeditor
 */
export let _getDisplayableTypes = function( selectedObject, createTemplateMap ) {
    var deferred = AwPromiseService.instance.defer();

    // get selections
    var mselection = appCtxSvc.getCtx( 'mselected' )[ 0 ];
    if( selectedObject ) {
        mselection = selectedObject;
    }

    var type;
    if ( mselection ) {
        type = mselection.internalType ? mselection.internalType : mselection.type;
    }
    if( !type ) {
        type = '';
    }

    var input = {
        exclusionBOTypeNames: [],
        option: 'HTML_TemplateWithPropMetaData',
        rootTypeName: type,
        specElementTypeName: 'SpecElement'
    };

    var inputData = {
        input: input
    };

    var promise = soaSvc.post( 'Internal-ActiveWorkspaceReqMgmt-2017-06-ImportExport', 'getDisplayableTypes',
        inputData );

    promise.then( function( response ) {
        var populateAllowedTypes = exports.extractElementTypesInfoFromResponse( response );
        if( createTemplateMap ) {
            setTemplateMapData( response );
        }
        deferred.resolve( populateAllowedTypes );
    } );

    return deferred.promise;
};

/**
 * Gets the sub Types for given or selected object
 *
 * @param {Object} selectedObject - The Selected object
 */
export let _getReqSpecSubTypeNames = function() {
    var deferred = AwPromiseService.instance.defer();
    var inputData = {
        inBOTypeNames: [ {
            typeName: 'RequirementSpec',
            contextName: 'subtypes',
            exclusionPreference:'AWC_TypeSelectorExclusionTypeList'
        } ]
    };

    var promise = soaSvc.post( 'Core-2013-05-DataManagement', 'getSubTypeNames',
        inputData );

    promise.then( function( response ) {
        var specElementTypes = [];
        var subTypeNames = response.output[ 0 ].subTypeNames;
        var displayableSubTypeNames = response.output[ 0 ].displayableSubTypeNames;

        for( var i = 0; i < subTypeNames.length; i++ ) {
            var elementType = {
                realTypeName:subTypeNames[i],
                displayTypeName:displayableSubTypeNames[i]
            };
            specElementTypes.push( elementType );
        }
        response.specElementTypes = specElementTypes;
        var populateAllowedTypes = exports.extractElementTypesInfoFromResponse( response );
        deferred.resolve( populateAllowedTypes );
    } );

    return deferred.promise;
};
/**
 * Gets the displayableTypes for given or selected object
 *
 * @param {Object} response -
 * @param {Object} deferred -
 */
var _populateAllowedTypes = function( response, deferred ) {
    var populateAllowedTypes = {};
    var objectTypesWithIcon = [];
    for( var i = 0; i < response.specElementTypes.length; i++ ) {
        var realTypeName = response.specElementTypes[ i ].realTypeName;
        var displayTypeName = response.specElementTypes[ i ].displayTypeName;
        var typeIconString = iconService.getTypeIconURL( realTypeName );

        var modelType = cmm.getType( realTypeName );
        if( modelType.abstract ) {
            continue;
        }

        if( !typeIconString ) {
            if( modelType && modelType.typeHierarchyArray ) {
                for( var ii = 0; ii < modelType.typeHierarchyArray.length && !typeIconString; ii++ ) {
                    typeIconString = iconService.getTypeIconURL( modelType.typeHierarchyArray[ ii ] );
                }
            }
        }

        if( !typeIconString ) {
            typeIconString = iconService.getTypeIconURL( 'MissingImage' );
        }

        var iconURL = browserUtils.getBaseURL() + typeIconString;

        // Add first type as default
        if( i === 0 ) {
            populateAllowedTypes.preferredType = realTypeName;
        }

        objectTypesWithIcon.push( {
            typeName: realTypeName,
            displayTypeName: displayTypeName,
            typeIconURL: iconURL
        } );

        // If type is 'Requirement', it will be preferred type
        if( realTypeName === 'Requirement' ) {
            populateAllowedTypes.preferredType = realTypeName;
        }
    }

    populateAllowedTypes.objectTypesWithIcon = objectTypesWithIcon;

    deferred.resolve( populateAllowedTypes );
};
/**
 * Extract allowed types from the response and return
 *
 * @param {Object} response - SOA response
 */
export let extractElementTypesInfoFromResponse = function( response ) {
    var displayableTypes = [];
    for( var i = 0; i < response.specElementTypes.length; i++ ) {
        var realTypeName = response.specElementTypes[ i ].realTypeName;
        displayableTypes.push( realTypeName );
    }
    // Load descriptors for model types, if not loaded
    var deferred = AwPromiseService.instance.defer();
    var promise = soaSvc.ensureModelTypesLoaded( displayableTypes );
    if( promise ) {
        promise.then( function() {
            _populateAllowedTypes( response, deferred );
        } );
    }

    return deferred.promise;
};

/**
 * Extract allowed types from the response and return
 *
 * @param {Object} response - SOA response
 */
export let handelGetDisplayableTypesEvent = function( eventData ) {
    exports._getDisplayableTypes( eventData.selected, true ).then( function( allowedTypesInfo ) {
        var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
        eventData.editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        if( !eventData.editor.config.objectTypeGlobalMap ) {
            eventData.editor.config.objectTypeGlobalMap = [];
        }
        eventData.editor.config.objectTypeGlobalMap.push( {
            parentType: eventData.selected.type,
            objectTypesWithIcon: allowedTypesInfo.objectTypesWithIcon,
            preferredType: allowedTypesInfo.preferredType
        } );

        if( eventData.callback ) {
            eventData.callback( allowedTypesInfo );
        }
    } );
};
/**
 * Extract allowed types from the response and return
 *
 * @param {Object} response - SOA response
 */
export let handelGetReqSpecSubTypeNamesEvent = function( eventData ) {
    exports._getReqSpecSubTypeNames().then( function( allowedTypesInfo ) {
        var editorId = appCtxSvc.getCtx( 'AWRequirementsEditor' ).id;
        var editor = ckeditorOperations.getCKEditorInstance( editorId, appCtxSvc.ctx );
        if( !editor.config.objectTypeGlobalMap ) {
            editor.config.objectTypeGlobalMap = [];
        }
        editor.config.objectTypeGlobalMap.push( {
            parentType: eventData.selected.type,
            objectTypesWithIcon: allowedTypesInfo.objectTypesWithIcon,
            preferredType: allowedTypesInfo.preferredType
        } );

        if( eventData.callback ) {
            eventData.callback( allowedTypesInfo );
        }
    } );
};

/**
 * Create templace map from response
 * @param {Object} response - json response data
 */
var setTemplateMapData = function( response ) {
    if( response ) {
        var templateMap = [];
        for( var ii = 0; ii < response.specElementTypes.length; ii++ ) {
            var realTypeName = response.specElementTypes[ ii ].realTypeName;
            var typeTemplate = '';
            for( var jj = 0; jj < response.rootTypes.length; jj++ ) {
                if( realTypeName === response.rootTypes[ jj ].realTypeName ) {
                    typeTemplate = response.rootTypes[ jj ].displayTypeName;
                    break;
                }
            }
            templateMap.push( {
                realTypeName: realTypeName,
                template: typeTemplate
            } );
        }
        var templateObjectBeingProcessed = '';
        if( templateMap.length > 0 ) {
            templateObjectBeingProcessed = templateMap[ 0 ].template;
            for( var ii = 0; ii < templateMap.length; ii++ ) {
                //If setting up templates before editing its ok to hard code Requirement
                //because it is the default type used after + button is clicked.
                if( templateMap[ ii ].realTypeName.toLowerCase() === 'Requirement'.toLowerCase() ) {
                    templateObjectBeingProcessed = templateMap[ ii ].template;
                    break;
                }
            }
            if( templateObjectBeingProcessed !== null ) {
                ckeditorOperations.setCKEditorSafeTemplate( appCtxSvc.getCtx( 'AWRequirementsEditor' ).id, templateObjectBeingProcessed, templateMap, appCtxSvc.ctx );
            }
        }
    }
};

/**
 * Initialization
 */
const loadConfiguration = () => {
    //subscribe getDisplayableTypes event to get the Displayable types for given object type
    eventBus.subscribe( 'ACEXRTHTMLEditor.getDisplayableTypes', function( eventData ) {
        exports.handelGetDisplayableTypesEvent( eventData );
    }, 'addElementTypeHandler' );
    //subscribe getReqSpecSubTypes event to get Requirement Specification Sub Types
    eventBus.subscribe( 'ACEXRTHTMLEditor.getReqSpecSubTypes', function( eventData ) {
        exports.handelGetReqSpecSubTypeNamesEvent( eventData );
    }, 'addElementTypeHandler' );
};

loadConfiguration();

export default exports = {
    _getDisplayableTypes,
    _getReqSpecSubTypeNames,
    extractElementTypesInfoFromResponse,
    handelGetDisplayableTypesEvent,
    handelGetReqSpecSubTypeNamesEvent
};
