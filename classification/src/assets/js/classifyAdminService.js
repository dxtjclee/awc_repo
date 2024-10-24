/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * This is a utility for admin services
 *
 * @module js/classifyAdminService
 */
import appCtxService from 'js/appCtxService';
import awIconSvc from 'js/awIconService';
import browserUtils from 'js/browserUtils';
import parsingUtils from 'js/parsingUtils';
import classifyAdminConstants from 'js/classifyAdminConstants';
import classifyAdminUtil from 'js/classifyAdminUtil';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import iconSvc from 'js/iconService';
import notyService from 'js/NotyModule';
import logger from 'js/logger';
import soaService from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import localeSvc from 'js/localeService';
import viewModelObjectService from 'js/viewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';


import _ from 'lodash';

var exports = {};
var _isNextPage = false;
var _timeout = null;

//Upon clicking the Node bar chart this helps to redirect to the correct
//tab
var NODES = 'clsNodes';
var CLASSES = 'clsClasses';
var PROPERTIES = 'clsProperty';
var KEYLOV = 'clsKeylov';

var isSubLocation = false;

var locale = localeSvc.getLocale();
if( locale.length === 2 ) {
    // SSO needs the 5 character locale, so "special case" the supported locales
    switch ( locale ) {
        case 'en':
            locale = 'en_US';
            break;
        case 'es':
            locale = 'es_ES';
            break;
        case 'de':
            locale = 'de_DE';
            break;
        case 'fr':
            locale = 'fr_FR';
            break;
        case 'it':
            locale = 'it_IT';
            break;
        default:
            // do nothing
            break;
    }
}

var _nodeId;
var _type;
var _owner;
var _dateModified;
var _nodesTitle;
var _classesTitle;
var _propertiesTitle;
var _keylovTitle;


var loadConfiguration = function() {
    localeSvc.getTextPromise( 'ClassificationAdminMessages', true ).then( function( localTextBundle ) {
        _nodeId = localTextBundle.nodeId;
        _type = localTextBundle.type;
        _owner = localTextBundle.owner;
        _dateModified = localTextBundle.dateModified;
        _nodesTitle = localTextBundle.nodesTitle;
        _classesTitle = localTextBundle.classesTitle;
        _propertiesTitle = localTextBundle.propertiesTitle;
        _keylovTitle = localTextBundle.keylovTitle;
    } );
};

loadConfiguration();

/**
 * This method is used to get the preference values for the CLS_CST_supported_eclass_releases preference.
 * @param {Object} response the response of the getPreferences soa
 * @returns {Object} preference values
 */
export let getReleasePreferenceValues = function( response ) {
    var prefs = [];

    var preferences = response.preferences;
    if( preferences.length > 0 && preferences[ 0 ].values ) {
        for( var idx = 0; idx < preferences[ 0 ].values.length - 1; idx++ ) {
            var pref = {
                internalName: preferences[ 0 ].values[ idx ],
                displayName: preferences[ 0 ].values[ idx + 1 ]
            };
            idx += 1;
            prefs.push( pref );
        }
    }

    return prefs;
};

/**
 * Following method retrieves expression based on collection of IRDI values provided
 *
 * @param {Array} ArrIRDI Collection of IRDI's
 * @param {*} type Supplied type
 * @returns {*} criteria
 */
export let getSearchCriteriaForArrayIRDI = function( ArrIRDI, type, classSystem ) {
    var searchCriteria;
    searchCriteria = getExpressionForArrayIRDI( ArrIRDI, type, classSystem );
    return searchCriteria;
};

/**
 * Following method build expression for supplied IRDI's
 * @param {Array} ArrIRDI Collection of IRDI's
 * @param {*} type Supplied type
 * @returns {*} expression
 */
export let getExpressionForArrayIRDI = function( ArrIRDI, type, classSystem, subType ) {
    if( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC && subType !== classifyAdminConstants.PARENTS ) {
        return {
            ObjectType: type,
            SearchExpression: {
                $eq: {
                    ID: classifyAdminConstants.ID,
                    Value: parseInt( ArrIRDI[0] )
                }
            },
            Options: {
                loadObjects: true,
                loadDependentObjects: true
            },
            Select: [
                classifyAdminConstants.ID,
                classifyAdminConstants.NAME
            ]
        };
    }
    return {
        ObjectType: type,
        SearchExpression: {
            $in: {
                ID: classifyAdminConstants.IRDI,
                Value: ArrIRDI
            }
        },
        Options: {
            loadObjects: true
        },
        Select: [
            classifyAdminConstants.IRDI,
            classifyAdminConstants.NAME
        ]
    };
};

/**
 * Following method checks whether the given string is of class type
 * @param {String} classTypeVal Refers to Class Type value
 * @return {Boolean} class type
 */
export let isClassType = function( classTypeVal ) {
    var isClassType = false;
    if( classTypeVal === classifyAdminConstants.GROUP_NODE ||
        classTypeVal === classifyAdminConstants.ABSTRACT_CLASS_TYPE ||
        classTypeVal === classifyAdminConstants.ABSTRACT_CLASS_TYPE_STRING ||
        classTypeVal === classifyAdminConstants.APP_CLASS ||
        classTypeVal === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT ||
        classTypeVal === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_BLOCK ||
        classTypeVal === classifyAdminConstants.NODE_APP_CLASS_TYPE_STRING_STORAGE ||
        classTypeVal === classifyAdminConstants.NODE_APP_CLASS_TYPE_STRING_ABSTRACT ) {
        isClassType = true;
    }
    return isClassType;
};

let addImage = function( object, type, classType ) {
    var imageIconUrl;
    if( object.IconFileTicket ) {
        imageIconUrl = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
            fmsUtils.getFilenameFromTicket( object.IconFileTicket ) + '?ticket=' + object.IconFileTicket;
    } else {
        var classifyIconName = classifyAdminConstants.MISSING_CLASS_IMG; //'indicatorMissingImage16.svg';
        if( type === classifyAdminConstants.NODES || type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
            classifyIconName = 'typeClassificationElement48.svg';
        } else if( type === classifyAdminConstants.CLASSES || type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
            switch ( classType ) {
                case classifyAdminConstants.GROUP_NODE:
                    classifyIconName = object.ID  === 'SAM' || object.ID  === 'ICM' ? 'typeClassificationRoot48.svg' : 'typeGroupClass48.svg';
                    break;
                case classifyAdminConstants.STORAGE_CLASS_TYPE:
                case classifyAdminConstants.STORAGE_CLASS_TYPE_STRING:
                    classifyIconName = classifyAdminConstants.STORAGE_CLASS_IMG; //'typeStorageClass48.svg';
                    break;
                case classifyAdminConstants.APP_CLASS :
                    classifyIconName = classifyAdminConstants.APPCLASS_CLASS_IMG; //'typeApplicationClass48.svg';
                    break;
                case classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT:
                    classifyIconName = classifyAdminConstants.ASPECT_CLASS_IMG; //'typeAspect48.svg';
                    break;
                case classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_BLOCK:
                    classifyIconName = classifyAdminConstants.BLOCK_CLASS_IMG; //'typeBlocks48.svg';
                    break;
                case classifyAdminConstants.ABSTRACT_CLASS_TYPE:
                case classifyAdminConstants.ABSTRACT_CLASS_TYPE_STRING:
                    classifyIconName = classifyAdminConstants.ABSTRACT_CLASS_IMG; //'typeAbstractClass48.svg';
                    break;
            }
        } else if( type === classifyAdminConstants.PROPERTIES || type === classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) {
            classifyIconName = classifyAdminConstants.PROPERTY_CLASS_IMG; //'typeProperty48.svg';
        } else if( type === classifyAdminConstants.KEYLOV || type === classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV ) {
            classifyIconName = classifyAdminConstants.OPTION_CLASS_IMG; //'typeOptionValue48.svg';
        }
        imageIconUrl = iconSvc.getTypeIconFileUrl( classifyIconName );
    }

    return imageIconUrl;
};

/**
 * Updates parents image
 *
 * @param {Array} children children
 * @param {String} childParents parent details
 * @param {String} type type of object
 */
let updateParentsImage = function( children, childParents, type ) {
    _.forEach( children, function( child ) {
        _.forEach( child.parents, function( parent ) {
            if ( childParents[ parent.ID ] ) {
                //update parent image
                parent.imageIconUrl = addImage( parent, type, childParents[ parent.ID ].ClassType );
            }
        } );
    } );
};

/**
 * Returns release displayname
 *
 * @param {Object} releases list of releases
 * @param {String} name internal name,
 * @returns {String} release display name
 */
let getReleaseDisplayName = function( releases, name ) {
    var displayName = name;
    if( releases && releases.eReleases ) {
        var idx = _.findIndex( releases.eReleases, function( release ) {
            return name === release.internalName;
        } );
        if( idx !== -1 ) {
            displayName = releases.eReleases[ idx ].displayName;
        }
    }
    return displayName;
};

/**
 * Returns selected releases
 *
 * @param {Object} data data
 * @returns {Array} selected release
 */
let getSelectedReleases = function( data ) {
    let supportedRelease = appCtxService.getCtx( 'preferences.CST_supported_eclass_releases' );

    let orignalLength;
    if( supportedRelease && supportedRelease.length ) {
        orignalLength = supportedRelease.length / 2;
    }
    let selected = [];
    let searchState = data && data.subPanelContext && data.subPanelContext.searchState ? data.subPanelContext.searchState : {};
    if( searchState && searchState.releases && searchState.releases.releasesStruct && searchState.releases.releasesStruct.length > 0 ) {
        _.forEach( data.subPanelContext.searchState.releases.releasesStruct, function( release ) {
            selected.push( release );
        } );

        if( selected.length === orignalLength ) {
            selected = [];
        }
    }
    return selected;
};
/**
 * Create object
 *
 * @param {Object} child child
 * @param {String} type JSON request object type
 * @param {Object} adminCtx admin context
 * @returns {Object} cells
 */
let getObject = function( child, type, adminCtx ) {
    var name = child.Name;
    if( child.SourceStandard ) {
        var displayName = getReleaseDisplayName( adminCtx.releases, child.SourceStandard );
        name += ' ( ' + displayName + ' )';
    }
    var cell = uwPropertySvc.createViewModelProperty( name, name, child.ObjectType, '', name );
    cell.cellHeader1 = name;
    cell.cellInternalHeader1 = name;
    cell.cellExtendedTooltipProps = name;
    cell.name = type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ? child.NodeId : child.IRDI;
    //If Basic, load id from ID field.
    cell.id = cell.name ? cell.name : child.ID;
    cell.uid = cell.id ? cell.id : child.ID;
    cell.hasChildren = child.HasChildren ? child.HasChildren : false;
    cell.type = type;

    //add missing icon
    var imageIconUrl;
    if( !isSubLocation ) {
        var tmpIcon = {
            typeHierarchy: '0'
        };
        imageIconUrl = awIconSvc.getTypeIconFileUrl( tmpIcon );
    }

    var classType = type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ? child.ClassType : null;
    imageIconUrl = addImage( child, type, classType );
    cell.thumbnailURL = imageIconUrl;
    cell.hasThumbnail = true;
    cell.parents = child.Parents;

    return cell;
};

/**
 * Created objects from the response for give type
 *
 * @param {Object} childNodes Objects
 * @param {String} type Supplied Object type
 * @returns {Object} cells
 */
export let getObjects = function( childNodes, type ) {
    var cells = [];
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );

    _.forEach( childNodes, function( child ) {
        var cell = getObject( child, type, adminCtx );
        cells.push( cell );
    } );

    return cells;
};

/**
 * Adjust search criteria  as needed
 * @param {Object} type type of object
 * @param {Object} criteria search criteria
 */
export let updateSearchCriteria = function( type, criteria ) {
    //Nodes do not have IRDIs. Replace with ID
    if( type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
        criteria.Select[ 0 ] = classifyAdminConstants.NODE_ID;
        criteria.Select.push( classifyAdminConstants.NODE_PUID );
        criteria.Select.push( classifyAdminConstants.NODE_ICONFILE_TICKET );
    } else if( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
        criteria.Select.push( 'ClassType' );
    }
};

/**
 * toggle importMode as import operation is performed
 * @param {Object} data type of object
 * @returns {Boolean} toggle importMode
 */
export let toggleImportMode = function( data ) {
    return !data.importMode;
};

/**
 * Gets search criteria based on type after Import
 * @param {Object} dataProvider data provider
 * @param {String} type Object type
 * @returns {Object} search criteria
 */
export let getSearchCriteriaAfterImport = function( dataProvider, type ) {
    return getSearchCriteriaForType( dataProvider, type, 0 );
};

/**
 * Gets search criteria based on type
 * @param {Object} dataProvider data provider
 * @param {String} type Object type
 * @param {BigInteger} index offset if importmode is true else undefined
 * @param {String} classSystem the system rule to use.
 * @param {Boolean} isDashboard true if summary page, false otherwise
 * @returns {Object} search criteria
 */
export let getSearchCriteriaForType = function( dataProvider, type, index, classSystem, isDashboard ) {
    //var startIndex = index !== undefined ? index : dataProvider.viewModelCollection.loadedVMObjects !== undefined ? dataProvider.viewModelCollection.loadedVMObjects.length : 0;
    var startIndex = 0;
    if( index ) {
        startIndex = index;
    } else if( dataProvider.viewModelCollection.loadedVMObjects !== undefined ) {
        startIndex = dataProvider.viewModelCollection.loadedVMObjects.length;
    }
    var criteria = {
        ObjectType: type,
        Options: {
            limit: 50,
            offset: startIndex
        },
        OrderBy: [ {
            ID: classifyAdminConstants.NAME,
            Sort: classifyAdminConstants.SORT_ASC
        } ]
    };

    if( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
        criteria.Select = [
            classifyAdminConstants.ID,
            classifyAdminConstants.NAME
        ];
        //add iconticket for classes both for summary and sublocation
        if ( type !== classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV && type !== classifyAdminConstants.JSON_REQUEST_TYPE_PROP  ) {
            criteria.Select.push( classifyAdminConstants.FILE_ICONS );
        }
        //add haschildren only for classes sublocation
        if ( !isDashboard && type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
            criteria.Select.push( classifyAdminConstants.HAS_CHILDREN );
        }
    } else {
        criteria.Select = [
            classifyAdminConstants.IRDI,
            classifyAdminConstants.NAME,
            classifyAdminConstants.HAS_CHILDREN
        ];
    }

    updateSearchCriteria( type, criteria );
    return criteria;
};

/**
   * Gets search criteria based on type
   * @param {Object} data view model
   * @param {String} dataProvider dataProvider
   * @param {String} type Object type
   * @param {Object} parentNode parentNode. Optional
   * @param {Boolean} isSearch isSearch. Optional
   * @param {String} classSystem the system rule to use.
   * @returns {Object} search criteria
   */
export let getSearchCriteriaForTree = function( data, dataProvider, type, parentNode, isSearch, classSystem ) {
    var criteria = getSearchCriteriaForType( dataProvider, type, null, classSystem );
    var addSource = true;

    var selected = getSelectedReleases( data );
    //selected will not be set if filters panel is not invoked
    // Do not add source standard for single selection
    if( selected.length === 1 ) {
        addSource = false;
    }

    if( addSource ) {
        criteria.Select.push( classifyAdminConstants.SOURCE_STANDARD );
    }

    //adjust start index
    if( data.treeLoadInput ) {
        criteria.Options.offset = data.treeLoadInput.startChildNdx;
        if ( _isNextPage ) {
            if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE && data.data.nodes ) {
                criteria.Options.offset = data.data.nodes.length;
                data.treeLoadInput.startChildNdx = data.data.nodes.length;
            } else if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS && data.data.classes ) {
                criteria.Options.offset = data.data.classes.length;
                data.treeLoadInput.startChildNdx = data.data.classes.length;
            }
        }
    }
    if( isSearch && data.treeLoadInput.startChildNdx > 0 ) {
        criteria.Options.offset = data.tmpObjectsLoaded;
    }
    return criteria;
};

/**
 * Gets search criteria based on type
 * @param {Object} data view model
 * @param {Object} dataProvider dataProvider
 * @param {String} type Object type
 * @param {Object} parentNode parentNode
 * @param {Object} isSearch true if search, false otherwise
 * @param {String} classSystem the system rule to use.
 * @returns {Object} search criteria
 */
export let getSearchCriteriaForHierarchy = function( data, dataProvider, type, parentNode, isSearch, classSystem ) {
    var criteria = getSearchCriteriaForTree( data, dataProvider, type, parentNode, isSearch, classSystem );
    var expression;
    if( parentNode.uid === classifyAdminConstants.TOP || _isNextPage ) {
        expression = {
            $null: {
                ID: classifyAdminConstants.PARENTS
            }
        };
    } else {
        criteria.Options.loadObjects = true;
        expression = {
            $eq: {
                ID: classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ? classifyAdminConstants.IMMEDIATE_PARENT_ADVANCED : classifyAdminConstants.IMMEDIATE_PARENT,
                Value: parentNode.uid
            }
        };
    }
    // For nodes and classes, add Parents to criteria to set up hierarchy
    if( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS || type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
        criteria.Select.push( classifyAdminConstants.PARENTS );
    }
    criteria.SearchExpression = expression;
    return criteria;
};


/**
 * Builds Search Criteria for SOA
 * @param {*} IRDI IRDI of Object
 * @param {*} type Type of Object
 * @returns {Object} search criteria
 */
export let getSearchCriteriaForIRDI = function( IRDI, type, classSystem ) {
    var criteria = {
        ObjectType: type,
        SearchExpression: {
            $eq: {
                ID: classifyAdminConstants.IRDI,
                Value: IRDI
            }
        },
        Options: {
            loadObjects: true
        },
        OrderBy: [ {
            ID: classifyAdminConstants.NAME,
            Sort: classifyAdminConstants.SORT_ASC
        } ]
    };
    if( type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
        criteria.SearchExpression.$eq.ID = classifyAdminConstants.NODE_ID;
        criteria.Select = [
            classifyAdminConstants.NODE_PUID,
            classifyAdminConstants.NODE_IMAGEFILE_TICKETS
        ];
    }
    return criteria;
};

/**
 * Builds Search Criteria for SOA
 * @param {*} IRDI IRDI of Object
 * @param {*} type Type of Object
 * @param {*} classSystem the system rule to use
 * @param {*} subType additional info for type
 * @returns {Object} search criteria
 */
export let getSearchCriteriaForId = function( IRDI, type, classSystem, subType ) {
    let value = typeof IRDI === 'string' ? IRDI : parseInt( IRDI );
    var criteria = {
        ObjectType: type,
        SearchExpression: {
            $eq: {
                ID: classifyAdminConstants.ID,
                Value: value
            }
        },
        Options: {
            loadObjects: true
        },
        OrderBy: [ {
            ID: classifyAdminConstants.NAME,
            Sort: classifyAdminConstants.SORT_ASC
        } ]
    };
    if( type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
        criteria.SearchExpression.$eq.ID = classifyAdminConstants.NODE_ID;
        criteria.Select = [
            classifyAdminConstants.NODE_PUID,
            classifyAdminConstants.NODE_IMAGEFILE_TICKETS
        ];
    } else if( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS && classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
        criteria.Select = [
            classifyAdminConstants.NODE_PUID
        ];
        if ( subType === classifyAdminConstants.PARENTS ) {
            criteria.Options = undefined;
            criteria.Select.push( classifyAdminConstants.CLASS_TYPE );
            criteria.Select.push( classifyAdminConstants.FILE_ICONS );
        } else {
            //support images for basic classes
            criteria.Select.push( classifyAdminConstants.NODE_IMAGEFILE_TICKETS );
        }
    }

    return criteria;
};

/**
 * Method populates builds the JSON request for SOA
 * @param {String} IRDI IRDI of object
 * @param {String} type type of object
 * @param {String} classSystem the system rule to use.
 * @returns {String} JSON object
 */
export let getJsonRequestForIRDI = function( IRDI, type, classSystem ) {
    let jsonRequest;
    let isSupported = classifyAdminUtil.getSupportedVersion();
    let schemaVersion = isSupported ? classifyAdminConstants.JSON_REQUEST_SCHEMA_VERSION :
        classifyAdminConstants.JSON_REQUEST_SCHEMA_VERSION_PREV;
    if( isSupported ) {
        jsonRequest = {
            SchemaVersion: schemaVersion,
            Locale: locale,
            IncludeDescriptors: true,
            SearchCriteria: getSearchCriteriaArrayIRDI( IRDI, type, classSystem )
        };
    } else {
        jsonRequest = {
            SchemaVersion: schemaVersion,
            Locale: locale,
            IncludeDisplayNames: true,
            SearchCriteria: getSearchCriteriaArrayIRDI( IRDI, type, classSystem )
        };
    }
    if ( isSupported ) {
        if( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
            jsonRequest.ClassificationSystem = classifyAdminConstants.CLASS_SYSTEM_BASIC;
        } else {
            jsonRequest.ClassificationSystem = classifyAdminConstants.CLASS_SYSTEM_ADVANCED;
        }
        if( type === 'PropertyDefinition' || type === 'KeyLOVDefinition' ) {
            jsonRequest.SearchCriteria = getSearchCriteriaArrayIRDI( IRDI, type, classSystem );
        } else if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
            //update search criteria
            jsonRequest.SearchCriteria[0].Options.loadDependentObjects = true;
        }
    }

    return JSON.stringify( jsonRequest );
};

/**
 * Method creates collection of search criteria's
 * @param {Object} IRDI IRDI of Object
 * @param {String} type type of object
 * @param {String} classSystem the system rule to use.
 * @returns {Array} search criteria
 */
export let getSearchCriteriaArrayIRDI = function( IRDI, type, classSystem ) {
    var searchCriteria = [];
    if( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
        searchCriteria[ 0 ] = getSearchCriteriaForId( IRDI, type, classSystem );
    } else {
        searchCriteria[ 0 ] = getSearchCriteriaForIRDI( IRDI, type, classSystem );
    }
    return searchCriteria;
};

/**
 * Gets search criteria based on defined filters and search box input.
 *
 * @param {Object} data view model
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {Object} criteria search criteria
 * @param {String} classSystem the current class system.
 */
let updateSearchCriteriaForSearch = function( data, parentNode, isSearch, criteria, classSystem ) {
    if( isSubLocation && isSearch ) {
        if( !parentNode || parentNode.uid === classifyAdminConstants.TOP || _isNextPage ) {
            //add searchbox value
            if( data.searchBox.dbValue !== null && data.searchBox.dbValue !== '' ) {
                //Both class hierarchy and name search criteria use the search expression value.
                criteria[ 0 ].SearchExpression = getSearchExpressionForName( data.searchBox.dbValue );
            }
            //add release filter to the search
            var selected = getSelectedReleases( data );
            if( selected.length > 0 ) {
                var selectedStr = [];
                _.forEach( selected, function( release ) {
                    // push all releases into array
                    selectedStr.push( release.propInternalValue );
                } );
                criteria[ 0 ].SearchExpression = modifySearchCriteriaForFilter( criteria[ 0 ],
                    classifyAdminConstants.SOURCE_STANDARD,
                    selectedStr, true );
            }
        } else {
            if( data.searchBox.dbValue !== null && data.searchBox.dbValue !== '' ) {
                //Both class hierarchy and name search criteria use the search expression value.
                var searchExpr = getSearchExpressionForName( data.searchBox.dbValue );
                if( criteria[ 0 ].SearchExpression ) {
                    var uidExpr = criteria[ 0 ].SearchExpression;
                    var andExpression = {
                        $and: [ uidExpr, searchExpr ]
                    };
                    criteria[ 0 ].SearchExpression = andExpression;
                }
            }
        }
        //add filters
        if( data && data.subPanelContext && data.subPanelContext.searchState && data.subPanelContext.searchState.filterMap && data.subPanelContext.searchState.filterMap.length ) {
            for( var filter of data.subPanelContext.searchState.filterMap ) {
                if( filter[ 0 ] && filter[ 1 ] ) {
                    criteria[ 0 ].SearchExpression = modifySearchCriteriaForFilter( criteria[ 0 ], filter[ 0 ], filter[ 1 ], false, classSystem );
                }
            }
        }
    }
};

let getSearchCriteriaForObjects = function( data, objects, type, parentNode, isSearch, classSystem, isDashboard ) {
    var searchCriteria;
    if( isSubLocation ) {
        if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS || type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
            searchCriteria = getSearchCriteriaForHierarchy( data, objects, type, parentNode, isSearch, classSystem );
        } else {
            searchCriteria = getSearchCriteriaForTree( data, objects, type, parentNode, isSearch, classSystem );
        }
    } else {
        searchCriteria = getSearchCriteriaForType( objects, type, null, classSystem, isDashboard );
    }
    return searchCriteria;
};

/**
 * Gets search criteria based on type
 *
 * @param {Object} data view model
 * @param {String} type type of object
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {Object} subPanelContext subpanel context
 * @param {String} classSystem the system rule to use.
 * @param {Boolean} isDashboard true if summary page, false otherwise
 * @returns {Object} search criteria
 */
export let getSearchCriteria = function( data, type, parentNode, isSearch, subPanelContext, classSystem, isDashboard ) {
    var searchCriteria = [];
    if( type === 'Attributes' ) {
        if( data.aspects && data.aspects.length > 0 ) {
            searchCriteria.push( getSearchCriteriaForArrayIRDI( data.aspects, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) );
        }
        if( data.property && data.property.length > 0 ) {
            searchCriteria.push( getSearchCriteriaForArrayIRDI( data.property, classifyAdminConstants.JSON_REQUEST_TYPE_PROP, classSystem ) );
        }
    }
    if( type === 'AttributesPanel' ) {
        if( subPanelContext.searchState.Panelaspects && subPanelContext.searchState.Panelaspects.length > 0 ) {
            searchCriteria.push( getSearchCriteriaForArrayIRDI( subPanelContext.searchState.Panelaspects, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) );
        }
        if( subPanelContext.searchState.Panelproperty && subPanelContext.searchState.Panelproperty.length > 0 ) {
            searchCriteria.push( getSearchCriteriaForArrayIRDI( subPanelContext.searchState.Panelproperty, classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) );
        }
    } else if( type === classifyAdminConstants.PROPERTIES ) {
        searchCriteria[0] = getSearchCriteriaForObjects( data, data.dataProviders.properties, classifyAdminConstants.JSON_REQUEST_TYPE_PROP, parentNode, isSearch, classSystem, isDashboard );
    } else if( type === classifyAdminConstants.KEYLOV ) {
        searchCriteria[0] = getSearchCriteriaForObjects( data, data.dataProviders.keylov, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV, parentNode, isSearch, classSystem, isDashboard );
    } else if( type === classifyAdminConstants.CLASSES ) {
        searchCriteria[0] = getSearchCriteriaForObjects( data, data.dataProviders.classes, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS, parentNode, isSearch, classSystem, isDashboard );
    } else if( type === classifyAdminConstants.NODES ) {
        searchCriteria[0] = getSearchCriteriaForObjects( data, data.dataProviders.nodes, classifyAdminConstants.JSON_REQUEST_TYPE_NODE, parentNode, isSearch, classSystem, isDashboard );
    } else if( type === classifyAdminConstants.SUMMARY ) {
        if( !data.importMode || data.importMode === undefined ) {
            searchCriteria[ 0 ] = getSearchCriteriaForType( data.dataProviders.properties, classifyAdminConstants.JSON_REQUEST_TYPE_PROP, null, classSystem, isDashboard );
            searchCriteria[ 1 ] = getSearchCriteriaForType( data.dataProviders.keylov, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV, null, classSystem, isDashboard );
            searchCriteria[ 2 ] = getSearchCriteriaForType( data.dataProviders.classes, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS, null, classSystem, isDashboard );
            //Request nodes only for Advanced class system
            if( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ) {
                searchCriteria[ 3 ] = getSearchCriteriaForType( data.dataProviders.nodes, classifyAdminConstants.JSON_REQUEST_TYPE_NODE, null, classSystem );
            }
        } else {
            searchCriteria[ 0 ] = getSearchCriteriaAfterImport( data.dataProviders.properties, classifyAdminConstants.JSON_REQUEST_TYPE_PROP );
            searchCriteria[ 1 ] = getSearchCriteriaAfterImport( data.dataProviders.keylov, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV );
            searchCriteria[ 2 ] = getSearchCriteriaAfterImport( data.dataProviders.classes, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS );
            searchCriteria[ 3 ] = getSearchCriteriaAfterImport( data.dataProviders.nodes, classifyAdminConstants.JSON_REQUEST_TYPE_NODE );
        }
    } else if( type === 'Parents' ) {
        _.forEach( data.parentIds, function( irdi ) {
            let criteria = getSearchCriteriaForId( irdi, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS, classSystem, classifyAdminConstants.PARENTS );
            searchCriteria.push( criteria );
        } );
    }

    updateSearchCriteriaForSearch( data, parentNode, isSearch, searchCriteria, classSystem );
    return searchCriteria;
};

/**
 * Builds Search Criteria for SOA
 * @param {*} name name of Object
 * @returns {Object} search expression
 */
export let getSearchExpressionForName = function( name ) {
    //Add the query data for search by name case.
    return {
        $like: {
            ID: classifyAdminConstants.NAME,
            Value: '*' + name + '*'
        }
    };
};

/**
 * Loads attribute properties
 * @param {Object} data view model
 * @param {String} type type
 * @param {Set} objects list of objects
 * @param {Object} columnConfig column configuration
 * @param {Set} attrColumns attribute columns
 * @returns {Object} updated column configuration
 */
let loadAttributeProps = function( data, type, objects, columnConfig, attrColumns ) {
    var tmpProps = getObjects( objects, type );
    data.tmpObjects = tmpProps;
    data.propsFound = objects ? objects.length : 0;

    if( objects && attrColumns ) {
        var i = 0;
        for( var attrColumn of attrColumns ) {
            //To be implemented if we want to change the width of columns in the Admin table.
            var columnWidth = 80;
            if( classifyAdminConstants.ARR_SHRUNK_COLUMNS.indexOf( attrColumn.InternalName ) !== -1 ) {
                columnWidth = 30;
            }
            const column = { displayName: attrColumn.DisplayName,
                isTableCommand: true,
                minWidth: columnWidth,
                name: attrColumn.InternalName,
                width: '*',
                enableColumnMoving: true
            };
            columnConfig.columns.push( column );
        }
        for( const [ objectsAttrName, objectsAttrIdx ] of Object.entries( objects ) ) {
            var props = {};
            var objAttr = objects[objectsAttrName];
            if( objAttr.length ) {
                for( var attrProp of objAttr ) {
                    if( attrProp.propertyName ) {
                        props[ attrProp.propertyName ] = classifyAdminUtil.createCell( attrProp.propertyName, attrProp.value );
                    }
                }
            } else { //We are an LOV table.
                for( const [ lovAttrName, lovAttrVal ] of Object.entries( objAttr ) ) {
                    //Have to add special processing for KeyLOVs as they do not conform to conventional Descriptor behavior.
                    props[ lovAttrName ] = classifyAdminUtil.createCell( lovAttrName, lovAttrVal );
                }
            }
            // props[ classifyAdminConstants.COLUMN_NAME ] = classifyAdminUtil.createCell( classifyAdminConstants.COLUMN_NAME, data.tmpObjects[ i ].propertyDisplayName );
            data.tmpObjects[ i ].props = props;
            i++;
        }
        return columnConfig;
    }
    //fill column property
    for( var i = 0; i < data.tmpObjects.length; i++ ) {
        var temp2 = classifyAdminUtil.createCell( classifyAdminConstants.COLUMN_NAME, data.tmpObjects[ i ].propertyName );
        var tempProps = {};
        tempProps[ classifyAdminConstants.COLUMN_NAME ] = temp2;
        data.tmpObjects[ i ].props = tempProps;
    }
};

/**
 * Following method acts as a data fetecher for data provider
 * @param {Object} data Declarative view model
 * @param {Object} type Supplied type
 * @param {Object} subPanelContext subpanel context
 * @param {String} classSystem the system rule to use.
 * @returns {Objects} response 1 Returns entries
 */
export let loadDataForAttributes = function( data, type, subPanelContext, classSystem ) {
    if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
        //No need to call SOA. Information already present
        loadAttributeProps( data, type, data.classAttributes );
        return {
            objects: data.tmpObjects,
            totalFound: data.propsFound
        };
    }
    var parentNode = {};
    var isSearch = false;
    var request = {
        jsonRequest: getJsonRequestForSearch( data, type, parentNode, isSearch, subPanelContext, classSystem )
    };
    let isSupported = classifyAdminUtil.getSupportedVersion();
    if( request.jsonRequest.includes( classifyAdminConstants.OBJECT_TYPE ) ) {
        return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
            var propDefs = classifyAdminUtil.parseJson( response.out, type, false );

            data.classAttributes = propDefs.objects;

            loadAttributeProps( data, type, data.classAttributes, propDefs.objects );
            return {
                objects: data.tmpObjects,
                totalFound: data.propsFound
            };
        } );
    }
    return {
        objects: [],
        totalFound: 0
    };
};

let addDescriptor = function( objectSet, object ) {
    let index = _.findIndex( objectSet, function( desc ) {
        return desc.InternalName === object.InternalName;
    } );
    if ( index === -1 ) {
        objectSet.push( object );
    }
};

/**
 * Converts the complicated descriptors into a flat list of descriptors for use with Class Attributes table.
 * @param {Object} descriptors the descriptors. Complex.
 * @param {Object} finalSet the set that will be used to construct the columns in the table.
 */
export let convertComplexClassDescriptor = function( descriptors, finalSet, parentName ) {
    let tmpDescriptors = descriptors ? Object.entries( descriptors ) : [];
    for( const [ descriptorKey, descriptor ] of tmpDescriptors ) {
        let setDescriptor = { ...descriptor };
        if( parentName ) {
            setDescriptor.InternalName = parentName + setDescriptor.InternalName;
            if ( parentName === classifyAdminConstants.ATTR_USERFUNCTION ) {
                setDescriptor.DisplayName = parentName + ' ' + setDescriptor.DisplayName;
            }
        }
        //Check for data type object, since we do not have the descriptor in processing attributes.
        if( descriptor.DataType.Properties ) {
            convertComplexClassDescriptor( descriptor.DataType.Properties, finalSet, setDescriptor.InternalName );
        } else if ( descriptor.DataType.Items ) {
            if( descriptor.DataType.Items.Properties ) {
                convertComplexClassDescriptor( descriptor.DataType.Items.Properties, finalSet, setDescriptor.InternalName );
            } else if ( descriptor.DataType.MaxItems ) {
                for( let x = 0; x < descriptor.DataType.MaxItems; x++ ) {
                    //Have to chop up even further to deal with array.
                    let arrDescriptor = { ...setDescriptor };
                    let intRep = x + 1;
                    arrDescriptor.InternalName += x;
                    arrDescriptor.DisplayName = arrDescriptor.DisplayName + ' ' + intRep;
                    addDescriptor( finalSet, arrDescriptor );
                }
            } else if( descriptor.DataType.Items.DataType && descriptor.DataType.Items.DataType.Properties ) {
                convertComplexClassDescriptor( descriptor.DataType.Items.DataType.Properties, finalSet, setDescriptor.InternalName );
            } else {
                addDescriptor( finalSet, setDescriptor );
            }
        } else {
            addDescriptor( finalSet, setDescriptor );
        }
    }
};

/**
 * Converts the complicated descriptors into a flat list of descriptors for use with Class Attributes table.
 * @param {Object} descriptors the descriptors. Complex.
 * @param {Object} finalSet the set that will be used to construct the columns in the table.
 * @param {String} dataType data type
 */
export let convertComplexClassDescriptorKeyLOVs = function( descriptors, finalSet, dataType ) {
    for( const [ descriptorKey, descriptor ] of Object.entries( descriptors ) ) {
        let setDescriptor = { ...descriptor };
        //Check for data type object, since we do not have the descriptor in processing attributes.
        if( !descriptor.DataType ) {
            //We are in advanced and dealing with an 'anyOf' type. Has to be processed differently.
            convertComplexClassDescriptorKeyLOVs( descriptor, finalSet, dataType );
        } else if( descriptor.DataType.Properties ) {
            convertComplexClassDescriptorKeyLOVs( descriptor.DataType.Properties, finalSet, dataType );
        } else if ( descriptor.DataType.Items && descriptor.DataType.Items.Properties ) {
            convertComplexClassDescriptorKeyLOVs( descriptor.DataType.Items.Properties, finalSet, dataType );
        } else if ( descriptor.DataType.Items && descriptor.DataType.Items.DataType ) {
            //We are in advanced and are unfolding 'anyOf' type's children.
            convertComplexClassDescriptorKeyLOVs( descriptor.DataType.Items.DataType.Properties, finalSet, dataType );
        } else {
            if( classifyAdminConstants.TABLE_COLUMN_KEY_DISALLOWED.indexOf( setDescriptor.InternalName ) === -1 ) {
                //ensure there are no duplicates
                addDescriptor( finalSet, setDescriptor );
            }
        }
    }
};

/**
 * Following method acts as a data fetecher for data provider
 * @param {Object} data Declarative view model
 * @param {Object} type Supplied type
 * @param {String} classSystem the system rule to use.
 * @param {DataProvider} columnProvider the current column provider.
 * @param {Array} descriptorColumns the descriptors to use
 * @param {Array} objects the objects to process into the table.
 * @returns {Objects} response the properties to populate a table, and a column configuration to use.
 */
export let loadTableAttributes = function( data, type, classSystem, columnProvider, descriptorColumns, objects ) {
    if ( data.conditions.supported ) {
        //No need to call SOA. Information already present
        //Will need to be updated with i18n.
        columnProvider.columns = [];
        let processedDescriptorColumns = [];
        if( !data.lovTypeItems ) {
            convertComplexClassDescriptor( descriptorColumns, processedDescriptorColumns );
        } else {
            convertComplexClassDescriptorKeyLOVs( descriptorColumns, processedDescriptorColumns, data.dataType );
        }
        if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC && data.hasClassAttributes ) {
            columnProvider.columns =  [ { displayName: classifyAdminConstants.COLUMN_NAME, isTableCommand: true, minWidth: 150, name: classifyAdminConstants.COLUMN_NAME, width: '*', pinnedLeft: true } ];
        }
        let columnConfig = loadAttributeProps( data, type, objects, columnProvider, processedDescriptorColumns );
        // if( data.lovTypeItems ) {
        //     columnConfig.columns[0].isTreeNavigation = true;
        // }
        return {
            objects: data.tmpObjects,
            totalFound: data.propsFound,
            columnProvider: columnConfig
        };
    }
};

/**
 * Builds Search Criteria for SOA
 * @param {Object} establishedCriteria the criteria that is already known.
 * @param {Object} newFilter the new filter being added to the criteria..
 * @param {Object} newFilterValue new value to filter by.
 * @param {Object} isMultiple true if multiple allow values
 * @param {String} classSystem the current class system.
 * @returns {Object} search criteria specifying to find objects of given criteria with determined filters.
 */
export let modifySearchCriteriaForFilter = function( establishedCriteria, newFilter, newFilterValue, isMultiple, classSystem ) {
    var expression = {};
    if( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC
        && ( establishedCriteria.ObjectType === classifyAdminConstants.JSON_REQUEST_TYPE_PROP
            || establishedCriteria.ObjectType === classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV )
        && newFilter !== classifyAdminConstants.NAME ) {
        var expr = {
            ID: newFilter,
            Value: newFilterValue
        };
    } else {
        var expr = {
            ID: newFilter,
            Value: isMultiple ? newFilterValue : '*' + newFilterValue + '*'
        };
    }
    if( isMultiple ) {
        //releases can be multiple
        expression.$in = expr;
    } else {
        expression.$like = expr;
    }
    var searchExpr = establishedCriteria.SearchExpression;

    if( !searchExpr ) {
        searchExpr = expression;
        //If searchExpression, may contain single $like or $in value.
    } else if( !searchExpr.$and ) {
        var $like = searchExpr.$like;
        var $in = searchExpr.$in;
        if( $like || $in ) {
            var andExpression = {
                $and: []
            };
            if( $like ) {
                andExpression.$and.push( { $like } );
            }
            if( $in ) {
                andExpression.$and.push( { $in } );
            }
            andExpression.$and.push( expression );
            expression = andExpression;
        }
        searchExpr = expression;
    } else {
        searchExpr.$and.push( expression );
    }

    return searchExpr;
};

/**
 * Builds Search Criteria for SOA
 * @param {String} name name of Object
 * @param {Object} criteria search criteria
 * @returns {Object} search criteria specifying to find objects of given criteria with a part of the name containing given name.
 */
export let getSearchCriteriaForName = function( name, criteria ) {
    //Add the query data for search by name case.
    var expression = {
        $like: {
            ID: classifyAdminConstants.NAME,
            Value: '*' + name + '*'
        }
    };
    if( !criteria.SearchExpression ) {
        criteria.SearchExpression = expression;
    } else {
        criteria.SearchExpression.$like = expression.$like;
    }
    return criteria;
};

/**
 * Clears the old object names/error status to populate new object names/error status
 * @param {*} data view model
 * @returns {Object} data
 */
export let clearData = function( data ) {
    data.captionName = '';
    data.systemError = false;
    if( data.objectNames !== undefined ) {
        data.objectNames = '';
        data.errorsExist = false;
    }
    return {
        captionName: data.captionName,
        systemError: data.systemError,
        objectNames: data.objectNames,
        errorExist: data.errorExist
    };
};

/**
 * Extracts meta data about a classification object to display in admin location.
 * Also, process unwrapping Access Info if necessary.
 * @param {Dictionary} metaDataDict the supplied dictionary of meta data for the classification.
 * @returns {Array} Array of applicable class traits.
 */
export let extractMetaData = function( metaDataDict ) {
    let arrMetaData = [];
    //Skip attributes that have their own sections. DisplayNames are descriptors and wil be skipped as well.
    const invalidAttrs = [
        classifyAdminConstants.CLASS_ATTRIBUTE,
        classifyAdminConstants.CLASS_ATTRIBUTE_OPTIONS,
        classifyAdminConstants.DISPLAY_NAMES,
        classifyAdminConstants.DATA_TYPE,
        classifyAdminConstants.DATA_TYPE_DEF,
        classifyAdminConstants.KEYLOV_LOVITEMS,
        classifyAdminConstants.ACCESS_INFO,
        classifyAdminConstants.OPTIONS,
        classifyAdminConstants.ALIAS_NAMES,
        classifyAdminConstants.PARENT,
        classifyAdminConstants.NODE_APP_CLASS,
        classifyAdminConstants.REFERENCE_ATTRIBUTE_DEFN,
        classifyAdminConstants.MULTI_SITE_INFO
    ];

    addDataTypeProps( metaDataDict, classifyAdminConstants.ACCESS_INFO, classifyAdminConstants.ACCESS_INFO );
    //determine from system view applicable attrs.
    const selectionAttrs = metaDataDict.displayNames.map( ( attr ) => { return attr.InternalName; } );
    //Unroll arrays.
    metaDataDict.displayNames.map( ( attr ) => {
        if ( attr.DataType.Type === 'array' && invalidAttrs.indexOf( attr.InternalName ) === -1 ) {
            if ( metaDataDict[attr.InternalName]  ) {
                let tmpName = metaDataDict[ attr.InternalName ];
                let value = tmpName[0];
                //UserData has Name/Value but not Parents
                if ( typeof tmpName[0] === 'object' && tmpName[0].hasOwnProperty( classifyAdminConstants.NAME ) ) {
                    value = tmpName[0].Name + ':' + tmpName[0].Value;
                }
                metaDataDict[attr.InternalName] = value;
            } else {
                //add all missing descriptors which are not in SOA response
                metaDataDict[ attr.InternalName ] = '';
            }
        } else {
            //add all missing descriptors which are not in SOA response
            if( !metaDataDict.hasOwnProperty( attr.InternalName ) ) {
                metaDataDict[ attr.InternalName ] = '';
            }
        }
    } );
    //Setup Access Info.
    if( metaDataDict[classifyAdminConstants.ACCESS_INFO] ) {
        for( const [ accessInfoMem, accessIdx ] of Object.entries( metaDataDict[classifyAdminConstants.ACCESS_INFO] ) ) {
            metaDataDict[accessInfoMem] = metaDataDict[classifyAdminConstants.ACCESS_INFO][accessInfoMem];
        }
    }
    for( const attr of selectionAttrs ) {
        if( invalidAttrs.indexOf( attr ) === -1 ) {
            arrMetaData.push( attr );
        }
    }
    return arrMetaData;
};

/**
 * Method creates JSON request for Search operaion as per supplied type of selected object
 *
 * @param {Object} data view model
 * @param {String} type type of object
 * @param {Object} parentNode parent node
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {Object} subPanelContext subpanel context
 * @param {String} classSystem the system rule to use.
 * @param {Boolean} isDashboard true if summary page, false otherwise
 * @returns {Object} JSON string
 */
export let getJsonRequestForSearch = function( data, type, parentNode, isSearch, subPanelContext, classSystem, isDashboard ) {
    var jsonRequest;
    let isSupported = classifyAdminUtil.getSupportedVersion();
    let schemaVersion = isSupported ? classifyAdminConstants.JSON_REQUEST_SCHEMA_VERSION :
        classifyAdminConstants.JSON_REQUEST_SCHEMA_VERSION_PREV;
    jsonRequest = {
        SchemaVersion: schemaVersion,
        Locale: locale,
        SearchCriteria: getSearchCriteria( data, type, parentNode, isSearch, subPanelContext, classSystem, isDashboard )
    };
    if ( isSupported ) {
        jsonRequest.IncludeDescriptors = !isDashboard;
        if( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
            jsonRequest.SchemaVersion = classifyAdminConstants.JSON_REQUEST_SCHEMA_VERSION_BASIC;
            jsonRequest.ClassificationSystem = classifyAdminConstants.CLASS_SYSTEM_BASIC;
        } else {
            jsonRequest.ClassificationSystem = classifyAdminConstants.CLASS_SYSTEM_ADVANCED;
        }
    } else {
        jsonRequest.IncludeDisplayNames = !isDashboard;
    }
    appCtxService.ctx.offset += 10;

    return JSON.stringify( jsonRequest );
};

/**
 * Following method calls SOA to get keyLOVs in tree format
 * @param {String} IRDI IRDI
 * @param {String} type Data Type
 * @param {Object} system Metric or Non - metric system key
 * @param {Object} subPanelContext sub panel context object
 * @param {String} classSystem the system rule to use
 */
export let getKeyLOV = function( IRDI, type, system, subPanelContext, classSystem ) {
    var request = {
        jsonRequest: getJsonRequestForIRDI( IRDI, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV, classSystem )
    };

    soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        var tree = [];
        var tmpKeylovs;
        var keyLOVObj;

        tmpKeylovs = classifyAdminUtil.parseJsonForObjectDefinitions( response.out, type, classSystem );
        keyLOVObj = tmpKeylovs[ IRDI ];

        var lovItems = keyLOVObj[ classifyAdminConstants.KEYLOV_LOVITEMS ];
        var key = classifyAdminConstants.JSON_RESPONSE_LOV + lovItems[ classifyAdminConstants.DATA_TYPE ] + classifyAdminConstants.JSON_RESPONSE_ITEMS;
        var LOVTypeItems = lovItems[ key ];

        var tmpState = subPanelContext.searchState.value;

        //Check for keys
        if( key === classifyAdminConstants.JSON_RESPONSE_KEYLOV_BOOLEAN ) {
            //Boolean type. It will always contains two values only
            buildLOVForBoolean( LOVTypeItems, tree );
        } else {
            for( var i = 0; i < LOVTypeItems.length; i++ ) {
                buildLOV( LOVTypeItems[ i ], type, tree );
            }
        }

        if( system === classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ) {
            tmpState.propertiesSWA.keyLOVTreeDataNonMetric = tree;
        } else {
            tmpState.propertiesSWA.keyLOVTreeDataMetric = tree;
        }
        subPanelContext.searchState.update( tmpState );
    } );
};

/**
 * Build LOV and adds to the application context
 * @param {Object} LOVObj LOV object to look up for
 * @param {*} tree treeData representation
 */
export let buildLOVForBoolean = function( LOVObj, tree ) {
    _.forEach( classifyAdminConstants.ARR_KEYLOV_RESPONSE_BOOL, function( key ) {
        var Obj = classifyAdminUtil.getObjectAsPerKey( LOVObj, key );
        var node = {};

        node.label = key + classifyAdminConstants.COLON + classifyAdminUtil.getObjectAsPerKey( Obj, classifyAdminConstants.DISPLAY_VALUE );
        node.children = [];
        tree.push( node );
    } );
};

/**
 * Builds LOV and add to the application context
 * @param {*} LOVObj LOVObject to look up for
 * @param {*} type DataType value
 * @param {*} tree treeData representation
 */
export let buildLOV = function( LOVObj, type, tree ) {
    //Individual node to be added
    var node = {};

    if( type === classifyAdminConstants.DATA_TYPE_REFERENCE ) {
        //special case for reference
        type = classifyAdminConstants.DATA_TYPE_STRING;
    }
    var entry = type + classifyAdminConstants.VALUE_KEY;

    var key = classifyAdminUtil.getObjectAsPerKey( LOVObj, entry );

    node.label = key;

    if( LOVObj.hasOwnProperty( classifyAdminConstants.DISPLAY_VALUE ) ) {
        node.label = key + classifyAdminConstants.COLON + classifyAdminUtil.getValue( LOVObj[ classifyAdminConstants.DISPLAY_VALUE ] );
    }

    node.children = [];

    //Check submenu exists
    var Is_submenu = classifyAdminUtil.getObjectAsPerKey( LOVObj, classifyAdminConstants.KEYLOV_IS_SUBMENU );
    if ( !Is_submenu ) {
        //TODO: hack till platform is fixed for spelling
        Is_submenu = classifyAdminUtil.getObjectAsPerKey( LOVObj, 'IsSubmenu' );
    }
    if( Is_submenu === true ) {
        //add submenu items
        var subItems = classifyAdminUtil.getObjectAsPerKey( LOVObj, classifyAdminConstants.KEYLOV_SUB_MENUITEMS );
        if ( !subItems ) {
            //TODO: server sets submenu flag without any submenuitems
            subItems = [];
        }
        for( var i = 0; i < subItems.length; i++ ) {
            buildLOV( subItems[ i ], type, node.children );
        }

        //check for submenu title
        //If IsSubMenu is set to true and the SubMenuTitle is missing, the SubMenuTitle is set to the DisplayValue.
        //If both are missing, the SubMenuTitle is set to the mandatory property StringValue.
        var subMenuTitle = classifyAdminUtil.getObjectAsPerKey( LOVObj, classifyAdminConstants.KEYLOV_SUB_MENU_TITLE );
        if( subMenuTitle && subMenuTitle !== '' ) {
            node.label = subMenuTitle;
        }
    }
    tree.push( node );
};

/**
 * Update selected releases
 *
 * @param {ViewModelProperty} prop - ViewModelProperty,
 * @param {Object} adminCtx admin context
 */
export let updateSelectedReleases = function( prop, adminCtx ) {
    let isValid = true;
    if( prop.propApi.validationApi ) {
        isValid = prop.propApi.validationApi( prop.dbValue );
    }
    if( isValid ) {
        adminCtx.releases.selected = adminCtx.releases.expandedList;
        // var prefs = prop.dbValue.split( ', ' );
        _.forEach( adminCtx.releases.selected, function( release ) {
            release.selected = 'false';
        } );
        _.forEach( prop.dbValue, function( pref ) {
            var jdx = _.findIndex( adminCtx.releases.selected, function( release ) {
                return release.internalName === pref;
            } );
            adminCtx.releases.selected[ jdx ].selected = 'true';
        } );
    }
};


/**
 * Add releases from preferences to LOV
 *
 * @param {ViewModelProperty} prop - the view model property
 * @param {Boolean} reset true if reset, false otherwise
 */
export let getReleasesExpanded = function( prop, reset ) {
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );
    var releasesExpandedList = [];
    if( !adminCtx.releases.expandedList || reset ) {
        _.forEach( adminCtx.releases.eReleases, function( release ) {
            var tmpProp = {
                internalName: release.internalName,
                displayName: release.displayName,
                selected: 'true'
            };
            releasesExpandedList.push( tmpProp );
        } );
        adminCtx.releases.expandedList = releasesExpandedList;
        appCtxService.updateCtx( 'clsAdmin', adminCtx );
    } else {
        releasesExpandedList = adminCtx.releases.expandedList;
    }

    var releasesSelected = _.filter( releasesExpandedList, function( o ) {
        return o.selected === 'true';
    } );
    adminCtx.releases.selected = releasesSelected;

    var db = [];
    var display = [];
    var displayStr = '';
    if( releasesExpandedList && releasesExpandedList.length > 0 ) {
        _.forEach( releasesExpandedList, function( release ) {
            if( release.selected === 'true' ) {
                db.push( release.internalName );
                display.push( release.displayName );
                displayStr += displayStr === '' ? '' : ', ';
                displayStr += release.displayName;
            }
        } );
    }

    prop.dbValue = db;
    prop.uiValues = display;
    prop.displayValues = display;
    prop.uiValue = displayStr;
};

/**
 * Replaces the objects in a set with new ones and replaces the record for the number of objects it contains with a new number.
 * @param {Array} origSet Object set to replace with new set of objects.
 * @param {*} origFound Number of found objects to rewrite with new information.
 * @param {*} dataProvider Data provider to update for display purposes
 * @param {Array} newSet Set of new objects.
 */
let replaceObjects = function( origSet, origFound, dataProvider, newSet ) {
    // Like in case of search, need to overwrite the contents of the given tab.
    origSet = newSet;
    origFound = newSet.length;
    dataProvider.viewModelCollection.setViewModelObjects( origSet );
    dataProvider.viewModelCollection.totalFound = origFound;
};

/**
 * Clears view model collection of each data provider. Used when switching class system in dashboard.
 * @param {*} data view model data
 */
export let resetDataProviders = function( data ) {
    //clear all data providers
    data.nodes = [];
    data.nodesFound = 0;
    data.dataProviders.nodes.getViewModelCollection().clear();
    data.classes = [];
    data.classesFound = 0;
    data.dataProviders.classes.getViewModelCollection().clear();
    data.properties = [];
    data.propsFound = 0;
    data.dataProviders.properties.getViewModelCollection().clear();
    data.keylovs = [];
    data.keylovFound = 0;
    data.dataProviders.keylov.getViewModelCollection().clear();
};

/**
 * Updates the objects in a set with new objects.
 * @param {Object} origObjects Object set to append with new objects; can be empty.
 * @param {Object} newObjects New objects to insert into the old set.
 * @param {Boolean} isNextPage true if next page, false otherwise
 * @return {Object} updated orig set
 */
let updateObjects = function( origObjects, newObjects, isNextPage ) {
    if( !origObjects || !isNextPage ) {
        origObjects = newObjects;
    } else {
        _.forEach( newObjects, function( obj ) {
            var idx = _.findIndex( origObjects, function( origObj ) {
                return origObj.id === obj.id;
            } );
            if( idx === -1 ) {
                origObjects.push( obj );
            }
        } );
        origObjects = _.sortBy( origObjects, 'propertyName' );
    }
    return origObjects;
};

/**
 * Method cleans the secondary work area data
 * @param {Object} subPanelContext sub panel context object
 */
export let resetSWAData = function( subPanelContext, selected ) {
    if( subPanelContext !== undefined && subPanelContext.searchState.propertiesSWA !== undefined ) {
        var tmpState = subPanelContext.searchState.value;
        if ( !selected ) {
            tmpState.pwaSelection = [];
        }
        tmpState.propertiesSWA = {};
        subPanelContext.searchState.update( tmpState );
    }
};

let addPropDataTypes = function( metaData, dataTypeProps, isClassAttrOptions ) {
    var dataTypeObjs = [];
    _.forEach( dataTypeProps, function( dataTypeProp ) {
        let obj = isClassAttrOptions ? dataTypeProp[1] : dataTypeProp;
        //check if property is already added to displayNames
        let index = _.findIndex( metaData.displayNames, function( display ) {
            return display.InternalName === obj.InternalName;
        } );
        if ( index === -1 ) {
            metaData.displayNames.push( obj );
        }
        dataTypeObjs.push( obj );
    } );
    return dataTypeObjs;
};

/**
 *
 * @param {*} metaData meta data
 * @param {*} propName prop name
 * @param {*} key key
 * @returns {*} data type props
 */
let addDataTypeProps = function( metaData, propName, key ) {
    var displayName = propName;
    let value = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE_TYPE );
    let dataTypeObjs = [];
    //update displayNames
    let index = _.findIndex( metaData.displayNames, function( display ) {
        return display.InternalName === key;
    } );
    if ( index !== -1 ) {
        let tmpDataType = value + classifyAdminConstants.DATA_TYPE;
        let dataTypeItems = metaData.displayNames[ index ].DataType.Items;
        let index1 = _.findIndex( dataTypeItems, function( dataType ) {
            return dataType.InternalName === tmpDataType;
        } );
        if ( index1 !== -1 || metaData.displayNames[index].DataType ) {
            let tmpDataTypeProps = [];
            if( index1 !== -1 ) {
                tmpDataTypeProps = dataTypeItems[index1].DataType.Properties;
            } else {
                tmpDataTypeProps = metaData.displayNames[index].DataType.Properties;
            }

            if ( key !== classifyAdminConstants.CLASS_ATTRIBUTE_OPTIONS ) {
                //correct datatypeprops if items is an array
                if ( metaData.displayNames[index].DataType.Type === 'array' ) {
                    tmpDataTypeProps = dataTypeItems.DataType.Properties;
                }
                dataTypeObjs = addPropDataTypes( metaData, tmpDataTypeProps, false );
            } else {
                tmpDataTypeProps = dataTypeItems.Items;
                dataTypeObjs = addPropDataTypes( metaData, tmpDataTypeProps, true );
            }
        }
    }
    return dataTypeObjs;
};

let addClassAttributeProps = function( obj, key ) {
    //update displayNames
    let index = _.findIndex( obj.displayNames, function( display ) {
        return display.InternalName === classifyAdminConstants.CLASS_ATTRIBUTE;
    } );
    if ( index !== -1 ) {
        let dataTypeItems = obj.displayNames[ index ].DataType.Items;
        let classAttributeProps = dataTypeItems.DataType.Properties;
        _.forEach( classAttributeProps, function( classAttributeProp ) {
            //check if property is already added to displayNames
            let index2 = _.findIndex( obj.displayNames, function( display ) {
                return display.InternalName === classAttributeProp.InternalName;
            } );
            if ( index2 === -1 ) {
                obj.displayNames.push( classAttributeProp );
            }
        } );
    }
};

/**
 * Method creates VMO property for SWA
 * @param {Object} obj Object contains key-value pairs of meta-data properties
 * @param {String} key Key to look up for within the object
 * @param {Boolean} isSupported of new SOA supported false otherwise
 * @param {Boolean} isDataType of data type
 * @param {Boolean} isClassAttribute of class attribute
 * @returns {String} displayName
 */
let addExtraProps = function( obj, key, isSupported, isDataType, isClassAttribute  ) {
    var displayName = key;
    if ( isSupported ) {
        //check key in display names
        let index = _.findIndex( obj.displayNames, function( display ) {
            return key === display.InternalName;
        } );
        if ( index === -1 ) {
            if ( isDataType ) {
                let adminCtx = appCtxService.getCtx( 'clsAdmin' );
                let classSystem = adminCtx.classSystem;
                //Advanced has DataTypeDef and Basic has DataType property
                let dataKey = classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ? classifyAdminConstants.DATA_TYPE_DEF :
                    classifyAdminConstants.DATA_TYPE;
                //update displayNames with datatype properties
                addDataTypeProps( obj, key, dataKey );
            }
            if ( isClassAttribute ) {
                addClassAttributeProps( obj, key );
            }
            //check for key again
            index = _.findIndex( obj.displayNames, function( display ) {
                return key === display.InternalName;
            } );
        }
        displayName = index !== -1 ? obj.displayNames[ index ].DisplayName : key;
    } else if ( obj.displayNames[ key ] !== '' && obj.displayNames[ key ] !== undefined ) {
        displayName = obj.displayNames[ key ];
    }
    return displayName;
};

/**
 * Method creates VMO property for SWA
 * @param {Object} obj Object contains key-value pairs of meta-data properties
 * @param {String} key Key to look up for within the object
 * @param {Array} arr Array refernce for VMO collection
 * @param {Boolean} isSupported of new SOA supported false otherwise
 * @param {Boolean} isDataType of data type
 * @param {Boolean} isClassAttribute of class attribute
 */
export let createSWAProperty = function( obj, key, arr, isSupported, isDataType, isClassAttribute ) {
    var valueObj = obj[ key ];
    var displayName = key;

    if( obj.displayNames !== '' && obj.displayNames !== undefined ) {
        displayName = addExtraProps( obj, key, isSupported, isDataType, isClassAttribute );
    }
    var cell;
    var value;

    if( key === classifyAdminConstants.PARENTS && Array.isArray( valueObj ) ) {
        value = valueObj[ 0 ];
        cell = uwPropertySvc.createViewModelProperty( key, displayName, '', value.toString(), value.toString() );
        cell.uiValue = value.toString();
    } else if( Array.isArray( valueObj ) ) {
        value = [];
        cell = uwPropertySvc.createViewModelProperty( key, displayName, classifyAdminConstants.STRING_ARRAY, value.toString(), value.toString() );
        uwPropertySvc.setIsArray( cell, true );

        if( valueObj && valueObj.length > 0 ) {
            uwPropertySvc.setArrayLength( cell, valueObj.length );
            for( var i = 0; i < valueObj.length; i++ ) {
                //take name and entry pair out
                // Name : Value
                var temp = valueObj[ i ];
                var name = '';
                if( temp.hasOwnProperty( classifyAdminConstants.NAME ) ) {
                    name = temp.Name;

                    if( temp.hasOwnProperty( 'Value' ) ) {
                        name = name + ':' + temp.Value;
                    }
                }
                cell.dbValue.push( name );
                cell.displayValues.push( name );
                cell.displayValsModel.push( { displayValue: name } );
            }
        }
    } else if( typeof valueObj === 'object' && valueObj !== null ) {
        value = classifyAdminUtil.getValue( valueObj );
        cell = uwPropertySvc.createViewModelProperty( key, displayName, '', value.toString(), value.toString() );
        cell.uiValue = value.toString();
    } else {
        //string and empty value
        if( valueObj === undefined || valueObj === null ) {
            valueObj = '';
        }
        if( key === classifyAdminConstants.IS_HIDE_KEYS && ( valueObj === undefined || valueObj === '' ) ) {
            valueObj = 'false';
        }
        value = valueObj;
        cell = uwPropertySvc.createViewModelProperty( key, displayName, '', value.toString(), value.toString() );
        cell.uiValue = value.toString();
    }

    uwPropertySvc.setEditable( cell, false );
    arr.push( cell );
};


let getAttrColumns = function( metaData, classSystem ) {
    var clsAttrsIdx = _.findIndex( metaData.displayNames, function( descriptor ) {
        return classifyAdminConstants.CLASS_ATTRIBUTE === descriptor.InternalName;
    } );

    if( clsAttrsIdx !== -1 ) {
        let attrColumns = metaData.displayNames[clsAttrsIdx].DataType.Items.DataType.Properties;
        //append class attribute options for advanced
        if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ) {
            let optionsProps = addDataTypeProps( metaData, classifyAdminConstants.CLASS_ATTRIBUTE_OPTIONS, classifyAdminConstants.CLASS_ATTRIBUTE_OPTIONS );
            attrColumns = attrColumns.concat( optionsProps );
        }
        return attrColumns;
    }
};

let getDependentObjectInfo = function( metaData, selectedId ) {
    let dependentInfo = {};
    let selectedObjDefn = metaData[ selectedId ];
    var classAttributes = classifyAdminUtil.getObjectAsPerKey( selectedObjDefn, classifyAdminConstants.CLASS_ATTRIBUTE );
    _.forEach( classAttributes, function( classAttr ) {
        let id = classAttr.AttributeId ? classAttr.AttributeId : classAttr.Reference;
        let attrDefn = metaData[ id ];
        if ( attrDefn ) {
            // classAttr.Name = classAttr.Name ? classAttr.Name : attrDefn.Name;
            dependentInfo[ id ] = attrDefn;
        }
    } );
    return dependentInfo;
};

/**
 * Populates the metaData properties to be shown in secondary work area for given selection
 * @param {Object} data Declarative view model
 * @param {Object} selected  Selected object in primary work area
 * @param {String} type type of object
 * @param {Object} subPanelContext sub panel context object
 * @param {String} classSystem the system rule to use.
 * @returns {Object} response
 */
export let selectNode = function( data, selected, type, subPanelContext, classSystem ) {
    var isSupported = classifyAdminUtil.getSupportedVersion();
    var tmpState = subPanelContext.searchState.value;
    var currentUid  = tmpState.pwaSelection  && tmpState.pwaSelection.length > 0 ? tmpState.pwaSelection[0].uid : '';
    if ( selected !== undefined && currentUid !== selected.uid  ) {
        if( !selected.type ) {
            selected.type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;
        }

        tmpState.propertiesSWA = {};
        tmpState.pwaSelection = [ selected ];
        var request = {
            jsonRequest: getJsonRequestForIRDI( selected.id, selected.type, classSystem )
        };

        return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
            var metaDataDef;
            var metaData;

            metaDataDef = classifyAdminUtil.parseJsonForObjectDefinitions( response.out, selected.type, classSystem );
            metaData = metaDataDef[ selected.id ];
            //Have to figure out what the correct unit system is.
            //Unit systems are returned as 0, 1, or 2. These symbolize different properties.
            getUnitSystemForClass( isSupported, classSystem, metaData, data );

            if( metaDataDef.displayNames !== undefined ) {
                metaData.displayNames = metaDataDef.displayNames;
            }

            //Array support for metric and non-metric support
            var plainProperties = [];
            var dataTypeMetric = [];
            var dataTypeNonMetric = [];

            //DataType & classType
            //classes do not contain datatype, hence capturing classtype.
            var dataTypeVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );
            var classTypeVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE );

            var arrMetaData = [];
            var requestTypes = [
                classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV,
                classifyAdminConstants.JSON_REQUEST_TYPE_PROP,
                classifyAdminConstants.JSON_REQUEST_TYPE_CLASS
            ];

            //14.2 and earlier use old schema which results displayName as StringArray. 14.3 returns descriptors or objects
            if ( isSupported ) {
                arrMetaData = extractMetaData( metaData );
            } else {
                //use hardcoded attributes
                if( isClassType( classTypeVal ) ) {
                    arrMetaData = classifyAdminConstants.ARR_METADATA_CLASS_PROP;
                } else if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV ) {
                    arrMetaData = classifyAdminConstants.ARR_METADATA_KEYLOV_PROP;
                } else if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) {
                    arrMetaData = classifyAdminConstants.ARR_METADATA_PROP;
                } else if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
                    arrMetaData = classifyAdminConstants.ARR_METADATA_CLASS_NODE;
                }
            }

            _.forEach( arrMetaData, function( key ) {
                createSWAProperty( metaData, key, plainProperties, isSupported );
            } );

            var valueObj;
            tmpState.propertiesSWA = {};

            //access info
            let accessInfo = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.ACCESS_INFO );
            //header info
            tmpState.propertiesSWA.isGroup = isClassType( classTypeVal );
            tmpState.propertiesSWA.headerInfo = {
                createUser: accessInfo ? accessInfo.CreateUser : undefined,
                modifyDate: accessInfo ? accessInfo.ModifyDate : undefined,
                id: selected.id,
                status: classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.STATUS ),
                type: classTypeVal ? classTypeVal : selected.type,
                uid: selected.uid
            };
            if ( accessInfo ) {
                addDataTypeProps( metaData, classifyAdminConstants.ACCESS_INFO, classifyAdminConstants.ACCESS_INFO );
                tmpState.propertiesSWA.createUser = accessInfo.CreateUser;
                tmpState.propertiesSWA.modifyDate = accessInfo.ModifyDate;
            }
            createSWAHeader( tmpState, classSystem, type );

            if( dataTypeVal === undefined &&
                classTypeVal === undefined && selected.type !== classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
                performOperationsForKeyLOVDefinition( metaData, plainProperties, subPanelContext, metaDataDef, classSystem, tmpState );
            } else if( dataTypeVal !== '' && classTypeVal === undefined ) {
                //DataType
                valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );
                if( valueObj !== undefined && metaData.displayNames !== undefined ) {
                    valueObj.displayNames = metaData.displayNames;
                }
                buildDataType( valueObj, dataTypeMetric, dataTypeNonMetric, subPanelContext, classSystem );
                tmpState.propertiesSWA.currentSecData = plainProperties;
                tmpState.propertiesSWA.dataTypeMetric = dataTypeMetric;
                tmpState.propertiesSWA.dataTypeNonMetric = dataTypeNonMetric;
            }

            //Multi-Site
            var multiSiteData = buildMultiSiteType( metaData, isSupported, classSystem );
            if ( multiSiteData ) {
                tmpState.propertiesSWA.multiSiteData = multiSiteData;
            }

            if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
                tmpState.propertiesSWA.currentSecData = plainProperties;
                data.dependentInfo = getDependentObjectInfo( metaDataDef, selected.id );

                var results = performOperationsForClassDefinition( metaData, data, type, classSystem );
                tmpState.propertiesSWA.aspects = results.aspects;
                tmpState.propertiesSWA.property = results.property;
                tmpState.propertiesSWA.classAttributes = results.classAttributes;
                tmpState.propertiesSWA.hasClassAttributes = Boolean( data.classAttributes );
                tmpState.propertiesSWA.referenceLinks = results.referenceLinks;
                tmpState.propertiesSWA.attrSelected = false;
                //Basic can have Options and Alias Names.
                tmpState.propertiesSWA.hasOptions = Boolean( _.entries( results.options ).length );
                tmpState.propertiesSWA.options = results.options;
                tmpState.propertiesSWA.hasAlias = Boolean( _.entries( results.alias ).length );
                tmpState.propertiesSWA.alias = results.alias;
                //Get images for basic classes
                if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
                    var imageInfo = classifyAdminUtil.getImageFileTickets( response.out, selected.type );
                    tmpState.propertiesSWA.hasImages = imageInfo.hasImages;
                    tmpState.propertiesSWA.selectedUid = imageInfo.puid;
                }

                tmpState.propertiesSWA.attrColumns = getAttrColumns( metaData, classSystem );
            } else if( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
                tmpState = performOperationsForNodeDefinition( data, metaData, selected, response, tmpState );
            } else if ( selected.type === classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) {
                tmpState = performOperationsForPropDefinition( metaData, isSupported, tmpState, classSystem );
            }
            tmpState.isTreeExpanding = false;

            subPanelContext.searchState.update( tmpState );
        } );
    }
    if( !subPanelContext.searchState.isTreeExpanding || subPanelContext.searchState.totalFound === 0 ) {
        resetSWAData( subPanelContext, selected );
    }
};


/**
 * Following method builds reference
 * @param {Object} metaData meta data
 * @param {Boolean} isSupported true if supported, false otherwise
 * @param {String} classSystem the system rule to use
 * @returns {Object} modified temporary searchState
 */
let performOperationsForPropDefinition = function( metaData, isSupported, tmpState, classSystem ) {
    //reference attribute
    tmpState.propertiesSWA.referenceAttrData = buildReferenceAttr( metaData, isSupported, classSystem );

    return tmpState;
};

/**
 * Following method performs the node definitions specific operations in secondary work area
 * @param {Object} data Declarative view model
 * @param {Object} metaData The response object
 * @param {Object} selected Selected object
 * @param {Object} response The response object
 * @param {Object} tmpState temporary sub panel context's searchState
 * @returns {Object} modified temporary searchState
 */
let performOperationsForNodeDefinition = function( data, metaData, selected, response, tmpState ) {
    var parentProp = [];
    var appClassProp = [];
    var valueObj;
    data.caption = data.i18n.properties;
    var isSupported = classifyAdminUtil.getSupportedVersion();

    //Check if it is a storage class
    valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.NODE_PARENT );
    if( valueObj ) {
        _.forEach( classifyAdminConstants.ARR_METADATA_NODE_PARENT, function( key ) {
            valueObj.displayNames = metaData.displayNames;
            createSWAProperty( valueObj, key, parentProp, isSupported );
        } );
        tmpState.propertiesSWA.parentProp = parentProp;
    }

    var NodeIdClassId = {};
    var tmpNodeId = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.NODE_ID );
    tmpNodeId = {
        type: classifyAdminConstants.NODE_APP_CLASS_TYPE,
        id: tmpNodeId
    };
    //check if it is an Application class
    valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.NODE_APP_CLASS );
    if( valueObj !== undefined && typeof valueObj === 'object' ) {
        NodeIdClassId = {
            type: classifyAdminConstants.JSON_REQUEST_TYPE_CLASS,
            id: ''
        };

        _.forEach( classifyAdminConstants.ARR_METADATA_NODE_APP_CLASS, function( key, index ) {
            if( index === 0 ) {
                NodeIdClassId.id = NodeIdClassId.id + valueObj[ key ].toString() + classifyAdminConstants.NODE_CLASS_ID_HASH;
            } else if( index === 1 ) {
                NodeIdClassId.id = NodeIdClassId.id + classifyAdminConstants.NODE_CLASS_ID + valueObj[ key ].toString() + classifyAdminConstants.NODE_CLASS_ID_HASH;
            } else {
                NodeIdClassId.id += valueObj[ key ].toString();
            }
            createSWAProperty( valueObj, key, appClassProp, isSupported );
        } );

        tmpState.propertiesSWA.appClassProp = appClassProp;
        tmpState.propertiesSWA.NodeIdClassId = NodeIdClassId;
        tmpState.propertiesSWA.classSystem = classifyAdminConstants.CLASS_SYSTEM_ADVANCED;
        tmpState.propertiesSWA.nodeId = tmpNodeId;
        tmpState.appClassData = undefined;
    } else {
        tmpState.propertiesSWA.appClassProp = undefined;
        tmpState.appClassData = {};
        //Abstract classes do not have application class.
        //SML nodes do not have ID. Only CST nodes have them
        tmpState.appClassData.isGroupNode = true;
        tmpState.appClassData.isCSTNode = false;
        let param = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.ID );
        if ( param !== undefined && param !== '' ) {
            tmpState.appClassData.isCSTNode = true;
        }

        tmpNodeId.type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;
        NodeIdClassId = tmpNodeId;
        tmpState.propertiesSWA.NodeIdClassId = NodeIdClassId;

        if( tmpState.appClassData.isCSTNode ) {
            tmpState.propertiesSWA.classSystem = classifyAdminConstants.CLASS_SYSTEM_ADVANCED;
        } else {
            tmpState.propertiesSWA.classSystem = classifyAdminConstants.CLASS_SYSTEM_BASIC;
        }
        tmpState.propertiesSWA.nodeId = tmpNodeId;
        var results = performOperationsForClassDefinition( metaData, data, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS, classifyAdminConstants.CLASS_SYSTEM_BASIC );
        tmpState.propertiesSWA.aspects = results.aspects;
        tmpState.propertiesSWA.property = results.property;
        tmpState.propertiesSWA.classAttributes = results.classAttributes;
        tmpState.propertiesSWA.hasClassAttributes = Boolean( data.classAttributes );

        tmpState.propertiesSWA.referenceLinks = results.referenceLinks;
        tmpState.propertiesSWA.attrSelected = false;
        //Basic can have Options and Alias Names.
        tmpState.propertiesSWA.hasOptions = Boolean( _.entries( results.options ).length );
        tmpState.propertiesSWA.options = results.options;
        tmpState.propertiesSWA.hasAlias = Boolean( _.entries( results.alias ).length );
        tmpState.propertiesSWA.alias = results.alias;
    }
    tmpState.propertiesSWA.selectedObject = selected;

    var imageInfo = classifyAdminUtil.getImageFileTickets( response.out );
    tmpState.propertiesSWA.hasImages = imageInfo.hasImages;
    tmpState.propertiesSWA.selectedUid = imageInfo.puid;
    tmpState.selectedPropertyGroup = null;

    return tmpState;
};

/**
 * Following method performs the class definitions specific operations in secondary work area
 * @param {Object} metaData The response object
 * @param {Object} data Declarative view model
 * @param {String} type Type
 * @param {String} classSystem the system rule to use.
 * @Returns {Object} class definition
 */
export let performOperationsForClassDefinition = function( metaData, data, type, classSystem ) {
    var aspects = [];
    var property = [];
    var classAttributes = {};
    var referenceLinks = {};
    var classOptions = {};
    var aliasNames = {};
    //class attributes
    buildClassAttributesTable( metaData, data, aspects, property, type, classAttributes, referenceLinks, classSystem );
    classOptions = buildClassOptionsDisplay( metaData );
    aliasNames = buildAliasNames( metaData );
    return {
        aspects: aspects,
        property: property,
        classAttributes: classAttributes,
        referenceLinks: referenceLinks,
        options: classOptions,
        alias: aliasNames
    };
};

/**
 * Following method performs the class options specific operations in secondary work area
 * @param {Object} metaData The response object
 * @param {Object} data Declarative view model
 * @param {String} type Type
 * @param {String} classSystem the system rule to use.
 * @Returns {Object} class definition
 */
export let buildClassOptionsDisplay = function( metaData, data, type, classSystem ) {
    var optionsObj = [];
    var isSupported = classifyAdminUtil.getSupportedVersion();
    var optionsVal = null;
    optionsVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.OPTIONS );
    if ( typeof optionsVal !== 'object' ) {
        optionsVal = {};
    }
    if ( optionsVal ) {
        //if options value is available, get props from descriptor
        let optionsProps = addDataTypeProps( metaData, classifyAdminConstants.OPTIONS, classifyAdminConstants.OPTIONS );
        optionsVal.displayNames = metaData.displayNames;
        _.forEach( optionsProps, function( key ) {
            createSWAProperty( optionsVal, key.InternalName, optionsObj, isSupported );
        } );
    }
    return optionsObj;
};

/**
 * Following method performs the class alias names specific operations in secondary work area
 * @param {Object} metaData The response object
 * @Returns {Object} class definition
 */
export let buildAliasNames = function( metaData ) {
    let swaProps = [];

    if( metaData[classifyAdminConstants.ALIAS_NAMES] ) {
        //Alias names is an array of item, each having 2properties Value and Language.
        for( const [ aliasMem ] of Object.entries( metaData[classifyAdminConstants.ALIAS_NAMES] ) ) {
            let language = metaData[classifyAdminConstants.ALIAS_NAMES][aliasMem].Language;
            if ( !language ) {
                language = '';
            }
            let value = String( metaData[classifyAdminConstants.ALIAS_NAMES][aliasMem].Value );

            var cell = uwPropertySvc.createViewModelProperty( language, language, '', value, value );
            cell.uiValue = value.toString();
            swaProps.push( cell );
        }
    }
    return swaProps;
};

/**
 * Following method performs the KeyLOV definition specific operations
 * @param {Array} keylovItems key lov items
 * @param {Array} plainProperties Collection of view model properties
 * @param {String} keyDataTypeValue data type value
 */
let addDataTypeForKeyLOV = function( keylovItems, plainProperties, keyDataTypeValue ) {
    let keyDataType = classifyAdminConstants.DATA_TYPE;
    let idx = _.findIndex( keylovItems, function( keylovType ) {
        return keylovType.InternalName === classifyAdminConstants.DATA_TYPE;
    } );


    //Currently server returning displayname as 'DataType'
    keyDataType = keylovItems[ idx ].DisplayName;
    //Create VMP and add to properties list
    var cell = uwPropertySvc.createViewModelProperty( classifyAdminConstants.DATA_TYPE, keyDataType, '',
        keyDataTypeValue.toString(), keyDataTypeValue.toString() );
    cell.uiValue = keyDataTypeValue;
    //Ensure it is not added multiple times
    let idx2 = _.findIndex( plainProperties, function( prop ) {
        return prop.propertyName === classifyAdminConstants.DATA_TYPE;
    } );
    if ( idx2 === -1 ) {
        plainProperties.push( cell );
    }
};


/**
 * Following method performs the KeyLOV definition specific operations
 * @param {Object} metaData The response object
 * @param {Array} plainProperties Collection of view model properties
 * @param {Object} subPanelContext sub panel context object
 * @param {Object} metaDataDef where the descriptor lives.
 * @param {String} classSystem the class system we're using.
 */
export let performOperationsForKeyLOVDefinition = function( metaData, plainProperties, subPanelContext, metaDataDef, classSystem, tmpState ) {
    //it means it's keyLOV
    var lovItems = metaData[ classifyAdminConstants.KEYLOV_LOVITEMS ];
    if( metaData.displayNames !== undefined ) {
        lovItems.displayNames = metaData.displayNames;
    }

    // var tmpState = subPanelContext.searchState.value;
    tmpState.propertiesSWA.currentSecData = plainProperties;
    var isSupported = classifyAdminUtil.getSupportedVersion();
    var lovIdx = -1;
    if( metaDataDef ) {
        lovIdx = _.findIndex( metaDataDef.descriptor, function( descriptor ) {
            return classifyAdminConstants.KEYLOV_LOVITEMS === descriptor.InternalName;
        } );
    }
    var dataT = classifyAdminUtil.getObjectAsPerKey( lovItems, 'DataType' );
    tmpState.propertiesSWA.dataType = dataT;
    var key = classifyAdminConstants.JSON_RESPONSE_LOV + dataT + classifyAdminConstants.JSON_RESPONSE_ITEMS;

    let keylovItems;
    if( lovIdx !== -1 ) {
        if( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
            keylovItems = metaDataDef.descriptor[lovIdx].DataType.Properties;
        } else {
            let tmpKeylovItems = metaDataDef.descriptor[lovIdx].DataType.Items;
            // let idx = dataT === classifyAdminConstants.DATA_TYPE_REFERENCE ? 2 : 1;
            //find the items w.r.t the dataType. Server reruning for all datatypes for Advanced
            let index = _.findIndex( tmpKeylovItems, function( keylovItem ) {
                return key === keylovItem[ keylovItem.length - 1].InternalName;
            } );
            if ( index !== -1 ) {
                keylovItems = tmpKeylovItems[ index ];
            }
        }
        tmpState.propertiesSWA.attrColumns = keylovItems;
    }

    // var dataT = classifyAdminUtil.getObjectAsPerKey( lovItems, 'DataType' );
    // tmpState.propertiesSWA.dataType = dataT;
    // var key = classifyAdminConstants.JSON_RESPONSE_LOV + dataT + classifyAdminConstants.JSON_RESPONSE_ITEMS;

    //For advanced, add datatype to properties
    if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ) {
        if ( isSupported ) {
            addDataTypeForKeyLOV( keylovItems, plainProperties, dataT );
        } else {
            createSWAProperty( lovItems, classifyAdminConstants.DATA_TYPE, plainProperties, isSupported );
        }
    }

    var LOVTypeItems = lovItems[ key ];
    if( !Array.isArray( LOVTypeItems ) ) {
        var arr = [];
        arr.push( classifyAdminUtil.getObjectAsPerKey( LOVTypeItems, 'False' ) );
        arr.push( classifyAdminUtil.getObjectAsPerKey( LOVTypeItems, 'True' ) );
        tmpState.propertiesSWA.lovTypeItems = arr;
    } else {
        tmpState.propertiesSWA.lovTypeItems = LOVTypeItems;
    }
};

export let selectNodeForNode = function( data, selected, classSystem ) {
    var isSupported = classifyAdminUtil.getSupportedVersion();
    if ( !selected || selected.id === '' ) {
        return null;
    }

    if( !isSupported && classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
        selected.type = classifyAdminConstants.JSON_REQUEST_TYPE_NODE;
    }

    var request = {
        jsonRequest: getJsonRequestForIRDI( selected.id, selected.type,  classSystem )
    };

    return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        var metaDataDef;
        var metaData;

        metaDataDef = classifyAdminUtil.parseJsonForObjectDefinitions( response.out, selected.type, classSystem );
        metaData = metaDataDef[ selected.id ];
        if( metaDataDef.displayNames !== undefined ) {
            metaData.displayNames = metaDataDef.displayNames;
        }

        //Array support for metric and non-metric support
        var plainProperties = [];

        //DataType & classType
        //classes do not contain datatype, hence capturing classtype.
        var classTypeVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE );

        getUnitSystemForClass( isSupported, classSystem, metaData, data );

        var arrMetaData = [];
        if( isClassType( classTypeVal ) && classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ) {
            arrMetaData = classifyAdminConstants.ARR_METADATA_NODE_APP_CLASS_JSON_CST;
        } else if ( isSupported && isClassType( classTypeVal ) && classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
            arrMetaData = classifyAdminConstants.ARR_METADATA_NODE_APP_CLASS_JSON_SML;
        } else if ( !isSupported && isClassType( classTypeVal ) && classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
            arrMetaData = classifyAdminConstants.ARR_METADATA_NODE_APP_CLASS_JSON_SML_OLDER_RELEAES;
        }

        _.forEach( arrMetaData, function( key ) {
            createSWAProperty( metaData, key, plainProperties, isSupported );
        } );


        return plainProperties;
    } );
};


/**
 * Resuable method for getting unit system for class definition
 * @param {Boolean} isSupported Platform compatibility variable
 * @param {Object} classSystem Class system for currently seelcted class definition
 * @param {*} metaData MetaData from SOA response
 * @param {*} data Declarative view model
 */
export let getUnitSystemForClass = function( isSupported, classSystem, metaData, data ) {
    if( isSupported ||   classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED && !isSupported  ) {
        //Tc14.3 comptibility and TC14.2 compatibility
        classifyAdminUtil.modifyUnitSystemForNodes( metaData );
    } else {
        //TC14.2 compatibility
        classifyAdminUtil.modifyUnitSystemForNodesForOlderReleases( metaData );
    }
};

/** To - Do : Refactors the below method for better purpose
 * Following method populates the data for panel
 * @param {Object} data Declarative view model
 * @param {Object} subPanelContext sub panel context
 * @param {String} classSystem the system rule to use.
 * @returns {Object} response
 */
export let selectNodeForPanel = function( data, subPanelContext, classSystem ) {
    if( data.reference !== null ) {
        var request = {
            jsonRequest: getJsonRequestForIRDI( data.reference.id, data.reference.type )
        };

        return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
            var metaDataDef;
            var metaData;

            metaDataDef = classifyAdminUtil.parseJsonForObjectDefinitions( response.out, data.reference.type, classSystem );
            metaData = metaDataDef[ data.reference.id ];

            if( metaDataDef.displayNames !== undefined ) {
                metaData.displayNames = metaDataDef.displayNames;
            }

            var plainProperties = [];
            var dataTypeMetric = [];
            var dataTypeNonMetric = [];

            var arrMetaData = [];
            if( data.reference.type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
                arrMetaData = classifyAdminConstants.ARR_METADATA_CLASS_PROP;
            } else if( data.reference.type === classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV ) {
                arrMetaData = classifyAdminConstants.ARR_METADATA_KEYLOV_PROP;
            }

            var isSupported = classifyAdminUtil.getSupportedVersion();
            _.forEach( arrMetaData, function( key ) {
                if( metaData[key] ) {
                    createSWAProperty( metaData, key, plainProperties, isSupported );
                }
            } );

            //DataType
            var valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );
            let dataTypeVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );
            let classTypeVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE );

            if(  dataTypeVal === undefined && classTypeVal === undefined  || dataTypeVal !== '' || classTypeVal !== '' ) {
                //Tricky : we need aw-tree hence we need to do this way
                buildDataType( valueObj, dataTypeMetric, dataTypeNonMetric, subPanelContext, classSystem );
            }

            if( data.reference.type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
                var Panelaspects = [];
                var Panelproperty = [];
                var classAttributes = [];
                var referenceLinks = {};

                buildClassAttributesTable( metaData, data, Panelaspects, Panelproperty, 'AttributesPanel', classAttributes, referenceLinks, classSystem );

                var valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_ATTRIBUTE );
                data.classAttributesResponseForPanel = valueObj;
            }
            //class attributes
            data.currentSecDataPanel = plainProperties;

            var tmpState = { ...subPanelContext.searchState.value };
            tmpState.reference = data.reference;
            tmpState.currentSecDataPanel = plainProperties;
            tmpState.Panelaspects = Panelaspects;
            tmpState.Panelproperty = Panelproperty;
            tmpState.classAttributesResponseForPanel = valueObj;
            tmpState.PanelClassAttributes = classAttributes;

            if( data.reference.isLink === true ) {
                tmpState.isLinkClicked = true;
            }
            subPanelContext.searchState.update( tmpState );
        } );
    }
};

/**
 * Following method builds the table for attributes
 * @param {Object} metaData Object representation for data
 * @param {Object} data Declarative view model
 * @param {Array} aspects list of aspects
 * @param {Array} property list of property definitions
 * @param {Object} type type
 * @param {Object} classAttributes list of class attributes
 * @param {Object} referenceLinks reference Links
 * @param {String} classSystem the system rule to use.
 */
export let buildClassAttributesTable = function( metaData, data, aspects, property, type, classAttributes, referenceLinks, classSystem ) {
    buildClassAttributeList( metaData, data, aspects, property, classAttributes, referenceLinks, classSystem );
    if( type !== 'Attributes' ) {
        eventBus.publish( 'entryGridForPanel.plTable.reload' );
    }
};

/**
 * Following method deals with processing for selected attribute
 * @param {Object} data Declarative view model
 * @param {Object} selected selected attribute in the table
 * @param {Object} subPanelContext sub panel context
 * @param {String} classSystem the system rule to use.
 * @returns {Object} promise
 */
export let selectNodeInSecWorkArea = function( data, selected, subPanelContext, classSystem ) {
    var tmpState = subPanelContext.searchState.value;
    if(  tmpState.isLinkClicked === true ) {
        tmpState.isLinkClicked = false;
        tmpState.currentSecDataPanel = [];
        tmpState.classAttributesResponseForPanel = [];
        tmpState.keyLOVTreeDataMetric = [];
        tmpState.reference = {};
        subPanelContext.searchState.update( tmpState );
    }


    data.attrprop = [];
    data.reference = {};

    if( selected.length === 0 ) {
        return {
            attrSelected: false,
            attrprop: [],
            reference: null
        };
    }

    var attrprop = data.classAttributes[ selected[ 0 ].id ].slice();

    _.forEach( attrprop, function( item ) {
        if( item.propertyName === 'Type' ) {
            selected[ 0 ].type = item.value;
        }
    } );

    if( selected[ 0 ].type === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT ) {
        var txt = 'Associated Class:' + selected[ 0 ].id;
        var cell = uwPropertySvc.createViewModelProperty( 'Reference', 'Reference', '', txt.toString(), txt.toString() );
        cell.uiValue = txt.toString();

        data.reference = cell;
        data.reference.isLink = true;
        data.reference.type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;
        data.reference.id = selected[ 0 ].id;
        data.attrprop = attrprop;
        return {
            attrSelected: true,
            attrprop: attrprop,
            reference: data.reference
        };
    }
    var deferred = AwPromiseService.instance.defer();
    var request = {
        jsonRequest: getJsonRequestForIRDI( selected[ 0 ].id, classifyAdminConstants.JSON_REQUEST_TYPE_PROP, classSystem )
    };
    soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        var metaDataDef;
        var metaData;
        var attrPropReplace = [];

        metaDataDef = classifyAdminUtil.parseJsonForAttrDefinitions( response.out );
        metaData = metaDataDef[ selected[0].id ];
        if( metaDataDef.displayNames !== undefined ) {
            metaData.displayNames = metaDataDef.displayNames;
        }

        //Array support for metric and non-metric support
        var plainProperties = [];
        var dataTypeMetric = [];
        var dataTypeNonMetric = [];

        var isSupported = classifyAdminUtil.getSupportedVersion();
        if ( isSupported ) {
            metaData.displayNames.map( ( attr ) => {
                if( attr.DataType.Type === 'array' && metaData[attr.InternalName] ) {
                    metaData[attr.InternalName] = metaData[attr.InternalName].join( ', ' );
                }
            } );
        }
        _.forEach( classifyAdminConstants.ARR_METADATA_PROP, function( key ) {
            if( metaData[key] ) {
                createSWAProperty( metaData, key, plainProperties, isSupported );
            }
        } );

        _.forEach( plainProperties, function( item ) {
            attrPropReplace.push( item );
        } );

        data.attrprop = attrPropReplace;

        //To-Do, Metric and non-metric units and values is issue
        if( classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE ) !== '' ||
            classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_TYPE ) !== '' ) {
            //DataType
            var valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.DATA_TYPE );

            buildDataType( valueObj, dataTypeMetric, dataTypeNonMetric, subPanelContext, classSystem );
        }

        //KeyLOV
        if( valueObj && valueObj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_KEYLOV ) ) {
            var value = classifyAdminUtil.getObjectAsPerKey( valueObj, classifyAdminConstants.DATA_TYPE_KEYLOV );

            //Hyper-link
            var link = [];
            var txt = classifyAdminConstants.ASSOCIATED_METRIC_KEYLOV + ':' + value.toString();
            var cell = uwPropertySvc.createViewModelProperty( 'KeyLOV', 'KeyLOV', '',
                txt.toString(), txt.toString() );

            cell.uiValue = txt.toString();
            data.reference = cell;
            data.reference.type = classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV;
            data.reference.isLink = true;
            data.reference.id = value;
        }

        //Reference
        if( valueObj && valueObj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE ) ) {
            var value = classifyAdminUtil.getObjectAsPerKey( valueObj, classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE );

            var arr = classifyAdminUtil.splitIRDI( value );

            //2nd position is of Object type - ID
            var objectType = arr[ 1 ].split( '-' );
            var txt = null;
            var cell = null;
            //Hyper-link
            var link = [];
            if( objectType[ 0 ] === classifyAdminConstants.CLASS_DEFINITION_OBJECT_TYPE ) {
                txt = 'Associated Class:' + value;
                cell = uwPropertySvc.createViewModelProperty( 'Reference', 'Reference', '', txt.toString(), txt.toString() );
                cell.uiValue = txt.toString();
                data.reference = cell;
                data.reference.type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;

                data.reference.isLink = true;
                data.reference.id = value;
            } else {
                var txt = classifyAdminConstants.ASSOCIATED_METRIC_KEYLOV + ':' + value.toString();
                cell = uwPropertySvc.createViewModelProperty( 'KeyLOV', 'KeyLOV', '',
                    txt.toString(), txt.toString() );
                cell.uiValue = txt.toString();
                data.reference = cell;
                data.reference.type = classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV;
                data.reference.isLink = true;
                data.reference.id = value;
            }
        }

        deferred.resolve( {
            attrSelected: true,
            attrprop: attrPropReplace,
            reference: data.reference
        } );
    } );
    return deferred.promise;
};

/**
 * Builds the class attributes list
 * @param {Object} metaData Object representation of SWA properties
 * @param {Object} data Declarative view model
 * @param {Object} aspects aspects
 * @param {Object} property property
 * @param {Object} classAttributes class attributes
 * @param {Object} referenceLinks reference links
 * @param {String} classSystem the system rule to use.
 */
export let buildClassAttributeList = function( metaData, data, aspects, property, classAttributes, referenceLinks, classSystem ) {
    var valueObj = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_ATTRIBUTE );

    data.classAttributes = valueObj;
    if( valueObj && Array.isArray( valueObj ) && valueObj.length > 0 ) {
        //class attributes are exists
        for( var i = 0; i < valueObj.length; i++ ) {
            let value = valueObj[ i ];
            let id = value.AttributeId ? value.AttributeId : value.Reference;
            let dependentInfo = data.dependentInfo ? data.dependentInfo[ id ] : null;
            buildClassAttribute( metaData, value, dependentInfo, aspects, property, classAttributes, referenceLinks, classSystem );
        }
    }
};

/**
 * Following method converts class attributes in an object form into a flat form for columns.
 * @param {Object} attrProps the known attribute set to record.
 * @param {Object} dependentInfo additional info
 * @param {Object} plainProperties the set to record to.
 * @param {Object} isSupported whether this is a supported set or not.
 */
export let convertComplexClassAttrs = function( attrProps, dependentInfo, plainProperties, isSupported, parentName ) {
    let tmpAttrProps = attrProps ? Object.entries( attrProps ) : [];
    //append additional props from KeyLovDefinitions
    let addlObjProps = dependentInfo ? Object.entries( dependentInfo ) : [];
    tmpAttrProps = tmpAttrProps.concat( addlObjProps );
    for( const [ attrPropsKey, attrPropsIdx ] of tmpAttrProps ) {
        let updatedParent = parentName + attrPropsKey;
        //Check for data type object, since we do not have the descriptor in processing attributes.
        if( attrPropsKey !== classifyAdminConstants.DISPLAY_NAMES ) {
            if( attrPropsIdx === Object( attrPropsIdx ) ) {
                if ( attrPropsKey === classifyAdminConstants.CLASS_ATTRIBUTE_OPTIONS ) {
                    updatedParent = '';
                }
                //Handle Name value till LCS-849005 is handled in server
                if ( attrPropsKey === classifyAdminConstants.NAME ) {
                    let propsObj = {};
                    propsObj[ updatedParent ] = attrPropsIdx.Value;
                    createSWAProperty( propsObj, updatedParent, plainProperties, isSupported, false, true );
                } else {
                    convertComplexClassAttrs( attrPropsIdx, null, plainProperties, isSupported, updatedParent );
                }
            } else {
                let propsObj = {};
                propsObj[updatedParent] = attrPropsIdx;
                createSWAProperty( propsObj, updatedParent, plainProperties, isSupported, false, true );
            }
        }
    }
};

/**
 * Following method builds the list of class attributes IRDI's
 * @param {Object} metaData Object containing class attributes data and displayNames
 * @param {Object} obj Object containing class attributes data
 * @param {Object} dependentInfo additional info
 * @param {Object} aspects aspects
 * @param {Object} property property
 * @param {Object} classAttributes class attributes
 * @param {Object} referenceLinks reference links
 * @param {String} classSystem the system rule to use.
 */
export let buildClassAttribute = function( metaData, obj, dependentInfo, aspects, property, classAttributes, referenceLinks, classSystem ) {
    var plainProperties = [];
    if( metaData.displayNames !== undefined ) {
        obj.displayNames = metaData.displayNames;
    }

    var link = [];
    var isSupported = classifyAdminUtil.getSupportedVersion();
    var valueClassOptions = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.CLASS_ATTRIBUTE_OPTIONS );
    var valueObjOptions = [];

    if ( valueClassOptions ) {
        for ( const [ attrKey, attrProp ] of Object.entries( valueClassOptions ) ) {
            if ( attrProp.AttributeIRDI === obj.Reference ) {
                for ( const [ name, value ] of Object.entries( attrProp ) ) {
                    if ( name !== 'AttributeIRDI' ) {
                        valueObjOptions[name] = value;
                    }
                }
            }
        }
    }

    convertComplexClassAttrs( obj, dependentInfo, plainProperties, isSupported, '' );
    //add class attribute options
    if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ) {
        let optionsProps = addDataTypeProps( metaData, classifyAdminConstants.CLASS_ATTRIBUTE_OPTIONS, classifyAdminConstants.CLASS_ATTRIBUTE_OPTIONS );
        let newObj = {};
        newObj.displayNames = metaData.displayNames;
        newObj.ClassAttributeOptions = valueObjOptions;
        convertComplexClassAttrs( newObj, null, plainProperties, isSupported, '' );
    }

    var type = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.CLASS_ATTRIBUTE_TYPE );

    createSWAProperty( obj, 'Reference', link, isSupported );

    if( type === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT ) {
        buildAttribute( aspects, obj.Reference );
        link[ 0 ].type = classifyAdminConstants.JSON_REQUEST_TYPE_CLASS;
    } else if( type === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_PROPERTY ) {
        buildAttribute( property, obj.Reference );
        link[ 0 ].type = classifyAdminConstants.JSON_REQUEST_TYPE_PROP;
    }

    classAttributes[ obj.Reference ] = plainProperties;
    referenceLinks[ obj.Reference ] = link[ 0 ];
    var clsRefIdx = _.findIndex( plainProperties, function( propToCheck ) {
        return propToCheck.propertyName === classifyAdminConstants.DATA_TYPE_REFERENCE;
    } );
    if( clsRefIdx !== -1 && isSupported ) {
        plainProperties[clsRefIdx] = link[ 0 ];
    }
    if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
        classAttributes[ obj.Reference ].Name = dependentInfo.Name;
        if( typeof dependentInfo.Name === 'object' ) {
            classAttributes[ obj.Reference ].Name = dependentInfo.Name.Value;
        }
        classAttributes[ obj.Reference ].ID = obj.AttributeId;
    }
};

/**
 * Creates entry within the specified array
 * @param {Object} arr collection of attributes
 * @param {*} entry entry within the array to be added
 */
export let buildAttribute = function( arr, entry ) {
    arr.push( entry );
};

/**
   * Wrapper method for data types
   * @param {*} obj  Supplied Object
   * @param {*} arr Output Array 1
   * @param {*} arr2 Output Array 2
   * @param {Object} subPanelContext sub panel context
   * @param {String} classSystem the system rule to use
   */
export let buildDataType = function( obj, arr, arr2, subPanelContext, classSystem ) {
    var dataType;
    var value;
    var isSupported = classifyAdminUtil.getSupportedVersion();
    if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_TYPE ) ) {
        if ( !isSupported ) {
            //It is part of descriptors for 14.3
            createSWAProperty( obj, classifyAdminConstants.DATA_TYPE_TYPE, arr, isSupported, true, false );
        }
        value = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.DATA_TYPE_TYPE );
        dataType = value;
        if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC && dataType === classifyAdminConstants.DATA_TYPE_KEYLOV ) {
            dataType = classifyAdminConstants.DATA_TYPE_STRING;
        }
    } else {
        value = '';
    }

    //StringDataType
    if( dataType === classifyAdminConstants.DATA_TYPE_STRING ) {
        buildNativeDataType( obj, arr, dataType, classifyAdminConstants.ARR_DATA_TYPE_STRING, null, subPanelContext, isSupported, classSystem );
        //Non-metric Format
        if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT )  ) {
            let nonMetricObj = obj[ classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ];
            nonMetricObj.displayNames = obj.displayNames;
            buildNativeDataType( nonMetricObj, arr2, dataType, classifyAdminConstants.ARR_DATA_TYPE_STRING,
                classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT, subPanelContext, isSupported, classSystem );
        }
    } else if( dataType === classifyAdminConstants.DATA_TYPE_INTEGER ) {
        buildNativeDataType( obj, arr, dataType, classifyAdminConstants.ARR_DATA_TYPE_INTEGER, classifyAdminConstants.DATA_TYPE_METRIC_FORMAT,
            subPanelContext, isSupported, classSystem );

        //Non - Metric Format
        if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ) ) {
            let nonMetricObj = obj[ classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ];
            nonMetricObj.displayNames = obj.displayNames;
            buildNativeDataType( nonMetricObj, arr2, dataType, classifyAdminConstants.ARR_DATA_TYPE_INTEGER,
                classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT, subPanelContext, isSupported, classSystem );
        }
    } else if( dataType === classifyAdminConstants.DATA_TYPE_DOUBLE ) {
        buildNativeDataType( obj, arr, dataType, classifyAdminConstants.ARR_DATA_TYPE_DOUBLE, classifyAdminConstants.DATA_TYPE_METRIC_FORMAT,
            subPanelContext, isSupported, classSystem );
        //Non-metric Format
        if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ) ) {
            let nonMetricObj = obj[ classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ];
            nonMetricObj.displayNames = obj.displayNames;
            buildNativeDataType( nonMetricObj, arr2, dataType, classifyAdminConstants.ARR_DATA_TYPE_DOUBLE,
                classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT, subPanelContext, isSupported, classSystem );
        }
    } else if( dataType === classifyAdminConstants.DATA_TYPE_BOOLEAN ) {
        buildNativeDataType( obj, arr, dataType, classifyAdminConstants.ARR_DATA_TYPE_BOOLEAN, null, subPanelContext, isSupported, classSystem );
    } else if( dataType === classifyAdminConstants.DATA_TYPE_REFERENCE ) {
        buildReferenceDataType( obj, arr, subPanelContext, isSupported, classSystem );
    } else if( dataType === classifyAdminConstants.DATA_TYPE_POSITION ||
        dataType === classifyAdminConstants.DATA_TYPE_AXIS ||
        dataType === classifyAdminConstants.DATA_TYPE_VALUE_RANGE ||
        dataType === classifyAdminConstants.DATA_TYPE_VALUE_WITH_TOLERANCE ||
        dataType === classifyAdminConstants.DATA_TYPE_LEVEL ) {
        buildComplexDataType( obj, arr, isSupported );
        if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ) ) {
            let nonMetricObj = obj[ classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT ];
            nonMetricObj.displayNames = obj.displayNames;
            buildComplexDataType( nonMetricObj, arr2, isSupported );
        }
    }
};

/**
 * Following method builds complex data type
 * @param {Object} obj Supplied Object
 * @param {Array} arr Output Array
 */
export let buildComplexDataType = function( obj, arr, isSupported, classSystem ) {
    createSWAProperty( obj, classifyAdminConstants.DATA_TYPE_UNIT, arr, isSupported );
};

/**
 * Following method builds multi site info
 * @param {Object} metaData meta data
 * @param {Boolean} isSupported true if supported, false otherwise
 * @param {String} classSystem the system rule to use
 */
export let buildMultiSiteType = function( metaData, isSupported, classSystem ) {
    var multiSiteObj = [];

    var multiSiteVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.MULTI_SITE );
    if ( multiSiteVal ) {
        //if multi site value is available, get props from descriptor
        let multiSiteProps = addDataTypeProps( metaData, classifyAdminConstants.MULTI_SITE_INFO, classifyAdminConstants.MULTI_SITE_INFO );
        multiSiteVal.displayNames = metaData.displayNames;
        _.forEach( multiSiteProps, function( key ) {
            createSWAProperty( multiSiteVal, key.InternalName, multiSiteObj, isSupported );
        } );
    }

    return multiSiteObj;
};

/**
 * Following method builds multi site info
 * @param {Object} metaData meta data
 * @param {Boolean} isSupported true if supported, false otherwise
 * @param {String} classSystem the system rule to use
 */
export let buildLibrary = function( metaData, isSupported, classSystem ) {
    var libraryObj = [];

    var libraryVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.MULTI_SITE );
    if ( libraryVal ) {
        //if multi site value is available, get props from descriptor
        let libraryProps = addDataTypeProps( metaData, classifyAdminConstants.MULTI_SITE_INFO, classifyAdminConstants.MULTI_SITE_INFO );
        libraryVal.displayNames = metaData.displayNames;
        _.forEach( libraryProps, function( key ) {
            createSWAProperty( libraryVal, key, libraryObj, isSupported );
        } );
    }

    return libraryObj;
};

/**
 * Following method builds reference attribute
 * @param {Object} metaData meta data
 * @param {Boolean} isSupported true if supported, false otherwise
 * @param {String} classSystem the system rule to use
 * @returns {Object} modified temporary searchState
 */
let buildReferenceAttr = function( metaData, isSupported, classSystem ) {
    var refAttrData = [];
    var refAttrVal = classifyAdminUtil.getObjectAsPerKey( metaData, classifyAdminConstants.REFERENCE_ATTRIBUTE );
    //Show empty Reference section if it is in descriptor but not in metadata
    refAttrVal = refAttrVal ? refAttrVal : {};

    let refAttrProps = addDataTypeProps( metaData, classifyAdminConstants.REFERENCE_ATTRIBUTE_DEFN, classifyAdminConstants.REFERENCE_ATTRIBUTE_DEFN );
    refAttrVal.displayNames = metaData.displayNames;
    _.forEach( refAttrProps, function( key ) {
        createSWAProperty( refAttrVal, key.InternalName, refAttrData, isSupported );
    } );

    return refAttrData;
};

/**
 * Method builds the reference data type
 * @param {Object} obj  Supplied Object
 * @param {Array} arr Output array
 * @param {Object} subPanelContext sub panel context object
 */
export let buildReferenceDataType = function( obj, arr, subPanelContext, isSupported, classSystem ) {
    let tmpArrayKey = isSupported ? [] : classifyAdminConstants.ARR_DATA_TYPE_REF;
    if ( isSupported ) {
        //Advanced has DataTypeDef and Basic has DataType property
        let dataKey = classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ? classifyAdminConstants.DATA_TYPE_DEF :
            classifyAdminConstants.DATA_TYPE;
        //update displayNames with datatype properties
        tmpArrayKey = addDataTypeProps( obj, classifyAdminConstants.DATA_TYPE_TYPE, dataKey );
    }

    _.forEach( tmpArrayKey, function( key ) {
        createSWAProperty( obj, key.InternalName, arr, isSupported );
    } );

    var value = classifyAdminConstants.DATA_TYPE_REFERENCE;
    var dataType = classifyAdminConstants.DATA_TYPE_REFERENCE;
    //KeyLOV
    if( obj && obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE ) ) {
        value = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE );

        //check its keylOv
        var arr = classifyAdminUtil.splitIRDI( value );
        var objectType = null;
        if( arr.length > 0 ) {
            objectType = arr[ 1 ].split( '-' );
        }

        var system = classifyAdminConstants.DATA_TYPE_METRIC_FORMAT;

        if( objectType && objectType.length > 0 && objectType[ 0 ] === '09' ) {
            getKeyLOV( value, dataType, system, subPanelContext );
        }
    }
};

/**
   * Method builds the boolean data type
   * @param {Object} obj Supplied Object
   * @param {Array} arr Resultant array
   * @param {String} dataType Supplied Data Type
   * @param {String} arrKey array key
   * @param {String} system sytem
   * @param {Object} subPanelContext subpanel context
   * @param {Boolean} isSupported true if new SOA supported false otherwise
   * @param {String} classSystem the system rule to use
   */
export let buildNativeDataType = function( obj, arr, dataType, arrKey, system, subPanelContext, isSupported, classSystem ) {
    let tmpArrayKey = isSupported ? [] : arrKey;

    if ( isSupported ) {
        //Advanced has DataTypeDef and Basic has DataType property
        let dataKey = classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ? classifyAdminConstants.DATA_TYPE_DEF :
            classifyAdminConstants.DATA_TYPE;
        //update displayNames with datatype properties
        tmpArrayKey = addDataTypeProps( obj, classifyAdminConstants.DATA_TYPE_TYPE, dataKey );
        //Skip attributes that are not applicable.
        let index = _.findIndex( tmpArrayKey, function( key ) {
            return key.InternalName === classifyAdminConstants.DATA_TYPE_NON_METRIC_FORMAT;
        } );
        if( index !== -1  ) {
            tmpArrayKey.splice( index, 1 );
        }
    }

    _.forEach( tmpArrayKey, function( key ) {
        createSWAProperty( obj, key.InternalName, arr, isSupported, true, false );
    } );

    //KeyLOV
    if( obj ) {
        let value = null;
        //Basic returns KeyLOVId and Advanced returns KeyLOV
        if ( obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_KEYLOV ) ) {
            value = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.DATA_TYPE_KEYLOV );
        } else if ( obj.hasOwnProperty( classifyAdminConstants.DATA_TYPE_KEYLOV_ID ) ) {
            value = classifyAdminUtil.getObjectAsPerKey( obj, classifyAdminConstants.DATA_TYPE_KEYLOV_ID );
        }
        if ( value ) {
            getKeyLOV( value, dataType, system, subPanelContext, classSystem );
        }
    }
};

/**
 * Update objects for search
 *
 * @param {Object} parents parents
 * @param {Object} objectSet set of objects
 * @param {String} type object type
 * @param {Object} parentNode parentNode
 * @returns {Object} updated set
 */
let updateObjectsForSearch = function( data, parents, objectSet, type, parentNode ) {
    var newSet = [];
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );
    var classSystem = adminCtx.classSystem;

    _.forEach( objectSet, function( object ) {
        if( object.parents && object.parents.length > 0 ) {
            var tmpParents = [];
            _.forEach( object.parents, function( parent ) {
                var parentDetails = parents[ parent ];
                if ( type === classifyAdminConstants.CLASSES ) {
                    parentDetails.ID = classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ? parentDetails.IRDI : parentDetails.ID;
                } else {
                    parentDetails.ID = parentDetails.NodeId;
                }
                parentDetails.imageIconUrl = addImage( parentDetails, type, parentDetails.ClassType );
                if( parentDetails.SourceStandard ) {
                    var displayName = getReleaseDisplayName( adminCtx.releases, parentDetails.SourceStandard );
                    if( parentDetails.Name.indexOf( displayName ) === -1 ) {
                        parentDetails.Name += ' (' + displayName + ' )';
                    }
                }
                tmpParents.push( parentDetails );
            } );
            object.parents = tmpParents;
        }
        if( !parentNode || parentNode.uid === classifyAdminConstants.TOP ||
            object.parents && object.parents[ 0 ] === parentNode.uid ||
            _isNextPage ) {
            newSet.push( object );
        }
    } );
    return newSet;
};


/**
 * Update objects for search
 *
 * @param {Object} parents parents
 * @param {Object} objectSet set of objects
 * @param {String} type object type
 * @param {Object} parentNode parentNode
 * @returns {Object} updated set
 */
export let updateObjectsForParents = function( data, parents, objectSet, type, parentNode ) {
    var newSet = [];
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );
    var classSystem = adminCtx.classSystem;

    let deferred = AwPromiseService.instance.defer();
    let idArray = [];
    _.forEach( parents, function( parent ) {
        idArray.push( parent.ID );
    } );
    var parentNode = {};
    data.parentIds = idArray;

    var request = {
        jsonRequest: getJsonRequestForSearch( data, classifyAdminConstants.PARENTS, parentNode, false, undefined, classSystem )
    };

    return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        var tree = [];
        // var parentDetails = classifyAdminUtil.parseJsonForObjectDefinitions( response.out, type, classSystem );
        var parentDetails = classifyAdminUtil.parseJsonForParents( response.out );

        _.forEach( idArray, function( parentId, idx ) {
            let tmpParent = parents[ parentId ];
            let tmpParentDetails = parentDetails[ idx ];
            tmpParent.ClassType = tmpParentDetails.ClassType;
            tmpParent.IconFileTicket = tmpParentDetails.IconFileTicket;
        } );
        let children = [];

        if ( type === classifyAdminConstants.CLASSES ) {
            children = data.classes;
        }
        updateParentsImage( children, parents,  type );
        data.children = children;
        return {
            objects: data.children,
            totalFound: data.children.length
        };
    } );
};

/**
 * Updates objects for sublocation
 *
 * @param {Object} origSet original set
 * @param {Object} origFound original found
 * @param {String} newSet new set
 * @param {Object} dataProvider data provider
 * @return {Object} updated original set
 */
let updateObjectsForSummary = function( origSet, origFound, newSet, dataProvider ) {
    var isNextPage = dataProvider.startIndex > 0;
    origSet = updateObjects( origSet, newSet, isNextPage );
    dataProvider.viewModelCollection.setViewModelObjects( origSet );
    dataProvider.viewModelCollection.totalFound = origFound;
    return origSet;
};

/**
 * Updates objects for sublocation
 *
 * @param {Object} parents parents
 * @param {Object} data view model
 * @param {Object} origSet original set
 * @param {Object} origFound original found
 * @param {String} newSet new set
 * @param {String} type column
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @return {Object} updated set
 */
let updateObjectsForSublocation = function( parents, data, origSet, origFound, newSet, type, parentNode, isSearch ) {
    data.tmpObjectsFound = origFound;
    data.tmpObjects = newSet;
    var objects = [];
    if( !isSearch ) {
        objects = newSet;
    } else {
        objects = updateObjectsForSearch( data, parents, newSet, type, parentNode );
    }

    if( parentNode && parentNode.uid !== classifyAdminConstants.TOP && !_isNextPage ) {
        data.children = newSet;
    } else {
        origSet = updateObjects( origSet, objects, _isNextPage );
        data.tmpObjectsLoaded = origSet.length;
        data.data.tmpObjectsLoaded = origSet.length;
        return origSet;
    }
};


/**
 * Parses response for each object type and sets data providers
 *
 * @param {Object} response SOA response
 * @param {Object} data view model
 * @param {String} type column
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {String} classSystem the system rule to use
 */
export let getJsonResponseForType = function( response, data, type, parentNode, isSearch, classSystem ) {
    var isSummary = type === classifyAdminConstants.SUMMARY;
    var numString = '';
    var typeString;
    var newSet;

    if( type === classifyAdminConstants.CLASSES || isSummary ) {
        var classDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.CLASSES, isSummary, isSearch );
        typeString = _classesTitle;
        data.classesFound = classDefs.totalFound;
        data.classesLoaded = classDefs.totalLoaded;
        data.classParents = classDefs.parents;
        var tmpClasses = getObjects( classDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS );
        if( !isSubLocation ) {
            numString = Number( data.classesFound ).toLocaleString();
            data.data.classesTitle = typeString + ' ( ' + numString + ' )';

            // Update viewModelCollection only once when the dashboard is loaded
            if( isSummary ) {
                updateObjectsForSummary( data.classes, data.classesFound, tmpClasses, data.dataProviders.classes );
            }
            data.classes = tmpClasses;
        }
        data.data.classes = data.classes;
        data.data.classesLoaded = data.classesLoaded;
        data.data.classesFound = data.classesFound;
        data.data.classParents = data.classParents;
    }

    if( type === classifyAdminConstants.PROPERTIES || isSummary ) {
        var propDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.PROPERTIES, isSummary );
        typeString = _propertiesTitle;
        data.propsFound = propDefs.totalFound;
        data.propsLoaded = propDefs.totalLoaded;

        //object collection of entries
        data.allPropDefs = classifyAdminUtil.parseJsonForObjectDefinitions( response.out, type );

        var tmpProps = getObjects( propDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_PROP );

        if( !isSubLocation ) {
            numString = Number( data.propsFound ).toLocaleString();
            data.data.propsTitle = typeString + ' ( ' + numString + ' )';

            // Update viewModelCollection only once when the dashboard is loaded
            if( isSummary ) {
                updateObjectsForSummary( data.properties, data.propsFound, tmpProps, data.dataProviders.properties );
            }
            data.properties = tmpProps;
        } else {
            data.properties = updateObjectsForSublocation( propDefs.parents, data, data.properties, data.propsFound, tmpProps, type,
                parentNode, isSearch );
        }

        data.data.properties = data.properties;
        data.data.propsLoaded = data.propsLoaded;
        data.data.propsFound = data.propsFound;
    }
    if( type === classifyAdminConstants.KEYLOV || isSummary ) {
        var keylovDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.KEYLOV, isSummary );
        var tmpKeylovs = getObjects( keylovDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV );
        typeString = _keylovTitle;
        data.keylovFound = keylovDefs.totalFound;
        data.keylovLoaded = keylovDefs.totalLoaded;

        if( !isSubLocation ) {
            numString = Number( data.keylovFound ).toLocaleString();
            data.data.keylovTitle = typeString + ' ( ' + numString + ' )';

            // Update viewModelCollection only once when the dashboard is loaded
            if( isSummary ) {
                updateObjectsForSummary( data.keylovs, data.keylovFound, tmpKeylovs, data.dataProviders.keylov );
            }

            data.keylovs = tmpKeylovs;
        } else {
            data.keylovs = updateObjectsForSublocation( keylovDefs.parents, data, data.keylovs, data.keylovFound, tmpKeylovs, type, parentNode, isSearch );
        }

        data.data.keylovs = data.keylovs;
        data.data.keylovLoaded = data.keylovLoaded;
        data.data.keylovFound = data.keylovFound;
    }
    if( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED && ( type === classifyAdminConstants.NODES || isSummary ) ) {
        var nodeDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.NODES, isSummary, isSearch );
        data.nodesFound = nodeDefs.totalFound;
        data.nodesLoaded = nodeDefs.totalLoaded;
        var tmpNodes = getObjects( nodeDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_NODE );
        typeString = _nodesTitle;
        if( !isSubLocation ) {
            numString = Number( data.nodesFound ).toLocaleString();
            data.data.nodesTitle = typeString + ' ( ' + numString + ' )';

            // Update viewModelCollection only once when the dashboard is loaded
            if( isSummary ) {
                updateObjectsForSummary( data.nodes, data.nodesFound, tmpNodes, data.dataProviders.nodes );
            }
            data.nodes = tmpNodes;
        } else {
            newSet = updateObjectsForSublocation( nodeDefs.parents, data, data.data.nodes, data.nodesFound, tmpNodes, type,
                parentNode, isSearch );
            if( newSet ) {
                data.nodes = newSet;
            }
        }
        data.data.nodes = data.nodes;
        data.data.nodesLoaded = data.nodesLoaded;
        data.data.nodesFound = data.nodesFound;
    }
    if( isSubLocation && ( !parentNode || parentNode.uid === classifyAdminConstants.TOP || isSearch ) ) {
        updateBreadCrumb( data, typeString, isSearch );
    }
};

/**
 * Parses response for each object type and sets data providers
 *
 * @param {Object} response SOA response
 * @param {Object} data view model
 * @param {String} type column
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {String} classSystem the system rule to use
 */
export let getJsonResponseForClasses = function( response, data, type, parentNode, isSearch, classSystem ) {
    var isSummary = type === classifyAdminConstants.SUMMARY;
    var typeString;
    var newSet;


    var classDefs = classifyAdminUtil.parseJson( response.out, classifyAdminConstants.CLASSES, isSummary, isSearch );
    typeString = _classesTitle;
    data.classesFound = classDefs.totalFound;
    data.classesLoaded = classDefs.totalLoaded;
    data.classParents = classDefs.parents;
    var tmpClasses = getObjects( classDefs.objects, classifyAdminConstants.JSON_REQUEST_TYPE_CLASS );

    newSet = updateObjectsForSublocation( classDefs.parents, data, data.classes, data.classesFound, tmpClasses, type,
        parentNode, isSearch );
    if( newSet ) {
        data.classes = newSet;
    }

    data.data.classes = data.classes;
    data.data.classesLoaded = data.classesLoaded;
    data.data.classesFound = data.classesFound;
    data.data.classParents = data.classParents;


    if( isSubLocation && ( !parentNode || parentNode.uid === classifyAdminConstants.TOP || isSearch ) ) {
        updateBreadCrumb( data, typeString, isSearch );
    }
    return data;
};

/**
 * Updates the breadcrumb if required and
 *
 * @param {Object} data data to extract information from to update breadcrumb.
 * @param {String} typeString type of classification item to represent in breadcrumb.
 * @param {Boolean} isSearch classification display is displaying search or filter results. Optional
 */
export let updateBreadCrumb = function( data, typeString, isSearch ) {
    var searchString = typeString;
    if( isSearch && data.searchBox.dbValue ) {
        searchString = data.searchBox.dbValue;
    }
    var andString = ' ' + data.i18n.and;

    var selected = getSelectedReleases( data );

    if( selected.length > 0 ) {
        searchString += andString + ' ';
        var releaseStr = data.i18n.releases + ': ';
        _.forEach( selected, function( release, idx ) {
            if( idx > 0 ) {
                releaseStr += ', ';
            }
            releaseStr += release.propDisplayValue;
        } );
        searchString += releaseStr;
    }
    if( data && data.subPanelContext && data.subPanelContext.searchState && data.subPanelContext.searchState.filterMap && data.subPanelContext.searchState.filterMap.length > 0 ) {
        searchString += andString + ' ';
        for( var filter of data.subPanelContext.searchState.filterMap ) {
            searchString = searchString + ' ' + filter[ 0 ] + ': ' + filter[ 1 ];
            if( filter !== data.subPanelContext.searchState.filterMap[ data.subPanelContext.searchState.filterMap.length - 1 ] ) {
                searchString += andString;
            }
        }
    }
    data.breadCrumbInfo.searchString = searchString;
    data.breadCrumbInfo.totalFound = data.tmpObjectsFound;
};

/**
 * Following method calls SOA to get admin objects
 *
 * @param {Object} data view model
 * @param {String} type column
 * @param {String} classSystem the system rule to use
 * @return {Objects} soa response
 */
export let getAdminObjects = function( data, type, classSystem ) {
    isSubLocation = false;

    var request = {
        jsonRequest: getJsonRequestForSearch( data, type, undefined, false, undefined, classSystem, true )
    };

    var ctx = appCtxService.getCtx( 'clsAdmin' );
    if( !ctx ) {
        ctx = {};
        ctx.releases = {};
        appCtxService.registerCtx( 'clsAdmin', ctx );
    }
    ctx.soaSupported = true;

    return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        getJsonResponseForType( response, data, type, null, false, classSystem );

        //update charts in dashboard
        if( type === classifyAdminConstants.SUMMARY ) {
            createChart( data, classSystem );
        }
        //clear import data
        ctx.import = {};
        appCtxService.updateCtx( 'clsAdmin', ctx );
        return classSystem;
    }, function( soaData ) {
        ctx.soaSupported = false;
        notyService.showError( data.i18n.noSOAError );
    } );
};

/**
 * Following method calls SOA to get admin objects
 * TODO: Nodes
 *
 * @param {Object} data view model
 * @param {String} type column
 * @param {Object} parentNode parentNode
 * @param {Boolean} isSearch true if search, false otherwise
 * @param {String} classSystem the system rule to use.
 * @return {Json} json response
 */
export let getAdminObjectsForSublocation = function( data, type, parentNode, isSearch, classSystem ) {
    isSubLocation = true;
    let isSupported = classifyAdminUtil.getSupportedVersion();
    if ( !isSupported && classSystem === classifyAdminConstants.CLASS_SYSTEM_BASIC ) {
        //Not supported
        let deferred = AwPromiseService.instance.defer();
        return deferred.promise;
    }
    //clear import data
    var ctx = appCtxService.getCtx( 'clsAdmin' );
    if( ctx ) {
        ctx.import = {};
    } else {
        ctx = {};
    }
    ctx.currentType = data.tableSummaryDataProviderName;
    if( type !== classifyAdminConstants.NODES ) { //Nodes default to Advance and should not be able to update the system.
        ctx.classSystem = classSystem;
    }
    appCtxService.updateCtx( 'clsAdmin', ctx );
    var request = {
        jsonRequest: getJsonRequestForSearch( data, type, parentNode, isSearch, undefined, classSystem, false )
    };

    return soaService.post( classifyAdminConstants.SOA_NAME, classifyAdminConstants.OPERATION_NAME, request ).then( function( response ) {
        if ( type === classifyAdminConstants.CLASSES && type !== classifyAdminConstants.SUMMARY ) {
            getJsonResponseForClasses( response, data, type, parentNode, isSearch, classSystem );
        } else {
            getJsonResponseForType( response, data, type, parentNode, isSearch, classSystem );
        }

        var response1 = {};
        response1 = {
            objects: data.tmpObjects,
            totalFound: data.tmpObjectsFound,
            classParents: data.classParents
        };

        var isNextPage = false;
        if( data && data.treeLoadInput ) {
            isNextPage = data.treeLoadInput.startChildNdx > 0;
        }

        if( isSearch && !data.treeLoadInput.parentNode._expandRequested && !isNextPage ) {
            resetSWAData();
        }

        return response1;
    }, function( soaData ) {
        notyService.showError( data.i18n.noSOAError );
    } );
};

/**
 * Following method creates the column chart
 * @param {*} data view model
 * @param {String} classSystem the system rule to use
 */
export let createChart = function( data, classSystem ) {
    //Initializing var for chart display and
    //on select function to redirect to correct chart.
    var chartProvider = {
        title: '',
        columns: [],
        onSelect: function( column ) { exports.barSelection( column ); }
    };

    //Display nodes only for Advanced
    if( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED && data.data.nodesFound !== 0 ) {
        chartProvider.columns.push( { label: _nodesTitle, value: data.data.nodesFound, key: NODES } );
    }

    if( data.data.classesFound !== 0 ) {
        chartProvider.columns.push( { label: _classesTitle, value: data.data.classesFound, key: CLASSES } );
    }

    if( data.data.propsFound !== 0 ) {
        chartProvider.columns.push( { label: _propertiesTitle, value: data.data.propsFound, key: PROPERTIES } );
    }

    if( data.data.keylovFound !== 0 ) {
        chartProvider.columns.push( { label: _keylovTitle, value: data.data.keylovFound, key: KEYLOV } );
    }

    data.data.chartProvider = chartProvider;
};

/**
 * Following method redirects to the appropriate tab based on the column chart
 * that is selected.
 * @param {*} column column
 */
export let barSelection = function( column ) {
    var stateSvc = AwStateService.instance;
    if( column.key === NODES ) {
        stateSvc.go( NODES, {}, {} );
    }
    if( column.key === CLASSES ) {
        stateSvc.go( CLASSES, {}, {} );
    }
    if( column.key === PROPERTIES ) {
        stateSvc.go( PROPERTIES, {}, {} );
    }

    if( column.key === KEYLOV ) {
        stateSvc.go( KEYLOV, {}, {} );
    }
};

/**
 * Following method gets the object names/error status from the ImportClassificationDefinitions soa's response
 * @param {*} objectNamesAndErrorStatus SOA response constaining error status and result
 * @param {*} data view model
 * @return {*} objectNames return all the object names to be displayed
 */
export let getObjectNames = function( objectNamesAndErrorStatus, data ) {
    var objectNamesAndErrorDetails = objectNamesAndErrorStatus.out;
    data.objectNames = new Map();
    var parsedResult = parsingUtils.parseJsonString( objectNamesAndErrorDetails );

    //if it is not partial errors then it could be
    //1. The schema version could be incorrect
    //2. The object type information could be incorrect
    //3. The Status information could be incorrect.
    //4. Empty json file
    if( parsedResult.ErrorDetails !== undefined && parsedResult.ErrorDetails[ 0 ] !== data.i18n.partialErrors ) {
        //system error helps in displaying system error.
        var errorInConsole = parsedResult.ErrorDetails[ 0 ];
        logger.error( errorInConsole );
        data.systemError = true;
        data.errorsExist = true;
        return;
    }

    //if the ErrorDetails contain partial errors then we need to parse through all the object names
    //to display the appropriate error in error icon.
    data.errorsExist = parsedResult.ResultStatus !== 0 && parsedResult.ErrorDetails[ 0 ] === data.i18n.partialErrors;

    var results = parsedResult.Result;

    if( results.length === 0 ) {
        data.objectNames = '';
    } else if( results[ 0 ].Name !== undefined || results[ 0 ].ErrorDetails !== undefined ) {
        data.captionName = getCaptionName( data, results[ 0 ] );
        if( data.captionName === '' ) { return; }
        results.forEach( function( object ) {
            let objectName = object.Name + ' (' + ( object.IRDI ? object.IRDI : object.ID ) + ')';
            if( object.ErrorDetails === undefined ) {
                data.objectNames.set( objectName, '' );
            } else {
                object.ErrorDetails[ 0 ] = object.ErrorDetails[ 0 ].replace( /"/g, '\'' );
                data.objectNames.set( objectName, { extendedTooltipContent: object.ErrorDetails[ 0 ] } );
            }
        } );

        data.objectNames = Array.from( data.objectNames );
    }

    //Save filename, fmsTicket and type for dashboard use
    if( !data.errorsExist ) {
        var ctx = appCtxService.getCtx( 'clsAdmin' );
        ctx.import = {
            fileName: data.fileName,
            fmsTicket: data.fmsTicket,
            importObjectType: data.captionName
        };
        appCtxService.updateCtx( 'clsAdmin', ctx );
    }
    return {
        newObjectNames: data.objectNames,
        newCaptionName: data.captionName,
        errorsExist: data.errorsExist
    };
};

/**
 * Parses through the objectdetails to retrieve the caption name
 * @param {*} data view model
 * @param {*} objectDetails contains the object details
 * @return {String} captionName contains a caption name information
 */
let getCaptionName = function( data, objectDetails ) {
    var stateSvc = AwStateService.instance;
    var pageStatus = stateSvc.current.name;
    var captionName;

    let objectType = objectDetails.IRDI ? objectDetails.IRDI.substring( objectDetails.IRDI.indexOf( '#' ) + 1, objectDetails.IRDI.indexOf( '-', objectDetails.IRDI.indexOf( '#' ) ) ) : undefined;
    switch ( objectType ) {
        case '09':
            captionName = data.i18n.keylovTitle;
            break;
        case '02':
            captionName = data.i18n.propertiesTitle;
            break;
        case '01':
            captionName = data.i18n.classesTitle;
            break;
        case undefined:
            captionName = data.i18n.nodesTitle;
            break;
    }

    data.captionName = captionName;
    return data.captionName;
};

/**
 * This is
 * @param {Object} data - the data object
 * @param {String} viewName - name of the aw-command-panel-section
 * @param {Boolean} isCollapsed - collapsed state of aw-command-panel-section
 */
export let expandOrCollapseSummary = function( data, viewName, isCollapsed ) {
    if( viewName === 'clsSummary' ) {
        data.summaryCollapsed = isCollapsed;
    }
};

/**
  * Following method calls SOA to get admin objects

  * @param {Boolean} isNextPage true if search, false otherwise
  */
export let setNextPage = function( isNextPage ) {
    _isNextPage = isNextPage;
};

/**
 * This is used to set location flag in karma tests
 * @param {Object} isLocation true if location, false otherwise
 */
export let setSublocation = function( isLocation ) {
    isSubLocation = isLocation;
};

/**
 * This is used to set clickedOnImport flag to true
 * @param {Object} data - the data object
 * @returns {boolean} set clickonimport flag to true after import button is clicked
 */
export let uploadAndImport = function( data ) {
    data.clickedOnImport = true;
    return data.clickedOnImport;
};

/**
 * This is used to reset clickedOnImport flag
 * @param {Object} data - the data object
 * @returns {boolean} set clickonimport flag to false after the file imported successfully
 */
export let fileImported = function( data ) {
    data.clickedOnImport = false;
    return data.clickedOnImport;
};

//TODO: Remove this after pwaSelection style works as expected
let createHeader = function( searchState, classSystem, sublocationName ) {
    let propertiesSWA = searchState.propertiesSWA;
    let headerInfo = propertiesSWA.headerInfo;
    let selectedNode = searchState.pwaSelection[0];

    let modelObject = {};
    modelObject.uid = headerInfo.uid;
    modelObject.hasThumbName = false;
    modelObject.props = {
        object_string: {
            uiValues: [ selectedNode.displayName ]
        },
        object_type : {
            displayName: _type,
            type: 'STRING',
            labelPosition: 'PROPERTY_LABEL_AT_SIDE',
            uiValue: headerInfo.type,
            uiValues: [ headerInfo.type ]
        }
    };
    //ID or IRDI:
    let idType = {
        type: 'STRING',
        labelPosition: 'PROPERTY_LABEL_AT_SIDE',
        uiValue: headerInfo.id,
        uiValues: [ headerInfo.id ]
    };
    if ( sublocationName === classifyAdminConstants.NODES ) {
        modelObject.props[classifyAdminConstants.NODE_ID] =  idType;
        modelObject.props[classifyAdminConstants.NODE_ID].displayName = classifyAdminConstants.NODE_ID;
    } else if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED  ) {
        modelObject.props[classifyAdminConstants.IRDI] =  idType;
        modelObject.props[classifyAdminConstants.IRDI].displayName = classifyAdminConstants.IRDI;
    } else {
        modelObject.props[classifyAdminConstants.ID] =  idType;
        modelObject.props[classifyAdminConstants.ID].displayName = classifyAdminConstants.ID;
    }
    //status
    if ( headerInfo.status ) {
        modelObject.props[classifyAdminConstants.STATUS] = {
            displayName: classifyAdminConstants.STATUS,
            type: 'STRING',
            labelPosition: 'PROPERTY_LABEL_AT_SIDE',
            uiValue: headerInfo.status,
            uiValues: [ headerInfo.status ]
        };
    }

    //Create user
    if ( headerInfo.createUser ) {
        modelObject.props[classifyAdminConstants.OWNING_USER] =
            {
                displayName: _owner,
                type: 'STRING',
                labelPosition: 'PROPERTY_LABEL_AT_SIDE',
                uiValue: headerInfo.createUser,
                uiValues: [ headerInfo.createUser ]
            };
    }
    //modify date
    if ( headerInfo.modifyDate ) {
        modelObject.props[ classifyAdminConstants.DATE_MODIFIED ] =
            {
                displayName: _dateModified,
                type: 'STRING',
                labelPosition: 'PROPERTY_LABEL_AT_SIDE',
                uiValue: headerInfo.modifyDate,
                uiValues: [ headerInfo.modifyDate ]
            };
    }
    // }
    let imgTokens = selectedNode.iconURL.split( '/' );
    let imgURL = imgTokens && imgTokens.length > 0 ? imgTokens[ imgTokens.length - 1] : '';
    modelObject.modelType = {
        constantsMap: {
            IconFileName: imgURL
        }
    };
    return viewModelObjectService.constructViewModelObjectFromModelObject( modelObject, null, null, null, null );
};

let createSWAHeader = function( searchState, classSystem, sublocationName ) {
    let propertiesSWA = searchState.propertiesSWA;
    let headerInfo = propertiesSWA.headerInfo;
    let selectedNode = searchState.pwaSelection[0];

    let modelObject = {};
    modelObject.uid = headerInfo.uid;
    modelObject.hasThumbName = false;

    let objType =  uwPropertyService.createViewModelProperty(
        classifyAdminConstants.OBJECT_TYPE_PROP,
        classifyAdminConstants.TYPE,
        'STRING',
        headerInfo.type,
        [ headerInfo.type ] );
    objType.uiValues = [ objType.uiValue ];
    objType.displayName = _type;

    modelObject.props = {
        object_string: {
            uiValues: [ selectedNode.displayName ]
        },
        object_type : objType
    };
    //ID or IRDI:
    let idName;
    if ( sublocationName === classifyAdminConstants.NODES ) {
        idName = classifyAdminConstants.NODE_ID;
    } else if ( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED  ) {
        idName = classifyAdminConstants.IRDI;
    } else {
        idName = classifyAdminConstants.ID;
    }
    let idType = uwPropertyService.createViewModelProperty( idName,
        classifyAdminConstants.TYPE,
        'STRING',
        headerInfo.id,
        [ headerInfo.id ] );
    idType.uiValues = [ idType.uiValue ];
    idType.displayName = idName;
    modelObject.props[idName] =  idType;

    //status
    let status = uwPropertyService.createViewModelProperty(
        classifyAdminConstants.STATUS,
        classifyAdminConstants.STATUS,
        'STRING', headerInfo.status,
        [ headerInfo.status ] );
    status.uiValues = [ status.uiValue ];
    status.displayName = classifyAdminConstants.STATUS;

    //Create user
    if ( headerInfo.createUser ) {
        let owningUser = uwPropertyService.createViewModelProperty(
            classifyAdminConstants.OWNING_USER,
            classifyAdminConstants.OWNER,
            'STRING',
            headerInfo.createUser,
            [ headerInfo.createUser ] );
        owningUser.uiValues = [ owningUser.uiValue ];
        owningUser.displayName = classifyAdminConstants.OWNING_USER;
        modelObject.props[classifyAdminConstants.OWNING_USER] = owningUser;
    }
    //modify date
    if ( headerInfo.modifyDate ) {
        let modDate = uwPropertyService.createViewModelProperty(
            classifyAdminConstants.LAST_MODIFIED_DATE,
            classifyAdminConstants.LAST_MODIFIED_DATE,
            'DATE',
            headerInfo.modifyDate,
            [ headerInfo.modifyDate ] );
        modDate.uiValues = [ modDate.uiValue ];
        modDate.displayName = classifyAdminConstants.LAST_MODIFIED_DATE;
        modelObject.props[ classifyAdminConstants.LAST_MODIFIED_DATE ] = modDate;
    }

    let imgTokens = selectedNode.iconURL.split( '/' );
    let imgURL = imgTokens && imgTokens.length > 0 ? imgTokens[ imgTokens.length - 1] : '';
    modelObject.modelType = {
        constantsMap: {
            IconFileName: imgURL
        }
    };
    selectedNode.props = modelObject.props;
    selectedNode.typeIconURL = selectedNode.iconURL;
};


/**
 * Used to externally setup the information required for the extremely data model reliant link function.
 * @param {Object} linkId contains information from the link itself.
 * @returns {Object} the reference link information
 */
export let setupDynamicReferenceLinks = function( linkId, type, subPanelContext, classSystem ) {
    let fakeData = {
        classAttributes: {}
    };
    fakeData.classAttributes[linkId] = [];
    let fakeSelected = [
        {
            id: linkId,
            type: type
        }
    ];
    return selectNodeInSecWorkArea( fakeData, fakeSelected, subPanelContext, classSystem );
};

/**
 * Initialize current sec data with the metaData properties in subPanelContext.searchState to be shown in secondary work area for given selection
 * @param {Object} searchState subPanelContext's searchState
 * @param {String} subLocationName sublocation name
 * @returns {Object} result object having SWA data
 */
export let initializeSWA = function( searchState, subLocationName, optionsTitle, aliasTitle ) {
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );
    var classSystem = adminCtx.classSystem;

    let result = {};
    let propertiesSWA = searchState.propertiesSWA;
    let hasProps = propertiesSWA !== undefined && propertiesSWA.currentSecData !== undefined;
    if( hasProps ) {
        result.currentSecData = propertiesSWA.currentSecData;
        result.multiSiteData = propertiesSWA.multiSiteData;

        if( subLocationName === 'Nodes' ) {
            result.hasImages = propertiesSWA.hasImages;
            result.selectedUid = propertiesSWA.selectedUid;
            result.appClassProp = propertiesSWA.appClassProp;
            result.parentProp = propertiesSWA.parentProp;
        } else {
            result.dataTypeMetric = propertiesSWA.dataTypeMetric;
            result.dataTypeNonMetric = propertiesSWA.dataTypeNonMetric;
            if( subLocationName === 'Classes' ) {
                result.aspects = propertiesSWA.aspects;
                result.property = propertiesSWA.property;
                result.classAttributes = propertiesSWA.classAttributes;
                result.hasClassAttributes = propertiesSWA.hasClassAttributes;
                result.referenceLinks = propertiesSWA.referenceLinks;
                result.attrProp = [];
                result.optionsTitle = optionsTitle;
                result.aliasTitle = aliasTitle;
                result.options = propertiesSWA.options;
                result.hasOptions = propertiesSWA.hasOptions;
                result.alias = propertiesSWA.alias;
                result.hasAlias = propertiesSWA.hasAlias;
                result.hasImages = propertiesSWA.hasImages;
                result.selectedUid = propertiesSWA.selectedUid;
            }
            if( subLocationName === 'Properties' ) {
                result.dataTypeMetric = propertiesSWA.dataTypeMetric;
                result.dataTypeNonMetric = propertiesSWA.dataTypeNonMetric;
                result.keyLOVTreeDataMetric = propertiesSWA.keyLOVTreeDataMetric;
                result.keyLOVTreeDataNonMetric = propertiesSWA.keyLOVTreeDataNonMetric;
                result.referenceAttrData = propertiesSWA.referenceAttrData;
                result.isAvailable = true;
            }
            if( subLocationName === 'KeyLOV' ) {
                result.dataType = searchState.propertiesSWA.dataType;
                result.lovTypeItems = searchState.propertiesSWA.lovTypeItems;
            }
        }
    }
    return result;
};

export let createListForPropertyAndAtrributeSection = function( data, subPanelContext ) {
    let item = { ...subPanelContext.searchState.value };
    return {
        currentSecDataPanel : item.currentSecDataPanel,
        keyLOVTreeDataMetric : item.propertiesSWA.keyLOVTreeDataMetric,
        classAttributesResponseForPanel : item.classAttributesResponseForPanel

    };
};

export let changeFileType = function( fileType ) {
    return fileType.value ? 'Awp0ClsAdminImportSub' : 'ImportPLMXMLSubPanel';
};


export default exports = {
    buildAttribute,
    barSelection,
    buildClassAttributeList,
    buildClassAttributesTable,
    buildClassAttribute,
    buildComplexDataType,
    buildDataType,
    buildLOVForBoolean,
    buildNativeDataType,
    buildReferenceDataType,
    changeFileType,
    clearData,
    createChart,
    createListForPropertyAndAtrributeSection,
    createSWAProperty,
    expandOrCollapseSummary,
    fileImported,
    getAdminObjects,
    getAdminObjectsForSublocation,
    getExpressionForArrayIRDI,
    getJsonRequestForIRDI,
    getJsonRequestForSearch,
    getJsonResponseForType,
    getKeyLOV,
    getObjects,
    getObjectNames,
    getReleasesExpanded,
    getReleasePreferenceValues,
    getSearchCriteria,
    getSearchCriteriaArrayIRDI,
    getSearchCriteriaForArrayIRDI,
    getSearchCriteriaForHierarchy,
    getSearchCriteriaForId,
    getSearchCriteriaForIRDI,
    getSearchExpressionForName,
    getSearchCriteriaForTree,
    getSearchCriteriaForType,
    getUnitSystemForClass,
    initializeSWA,
    isClassType,
    loadDataForAttributes,
    modifySearchCriteriaForFilter,
    performOperationsForKeyLOVDefinition,
    performOperationsForClassDefinition,
    loadTableAttributes,
    resetDataProviders,
    resetSWAData,
    selectNode,
    selectNodeForNode,
    selectNodeInSecWorkArea,
    selectNodeForPanel,
    setNextPage,
    setSublocation,
    setupDynamicReferenceLinks,
    toggleImportMode,
    uploadAndImport,
    updateBreadCrumb,
    updateSelectedReleases,
    updateObjectsForParents
};
