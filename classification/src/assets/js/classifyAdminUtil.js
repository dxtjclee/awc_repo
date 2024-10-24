// Copyright (c) 2022 Siemens

/**
 * This is a utility for admin services
 *
 * @module js/classifyAdminUtil
 */
import classifyAdminConstants from 'js/classifyAdminConstants';
import localeSvc from 'js/localeService';
import parsingUtils from 'js/parsingUtils';
import TcServerVersion from 'js/TcServerVersion';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

var _currentLocale = localeSvc.getLanguageCode();
var _metric;
var _nonMetric;
var _unspecified;


var loadConfiguration = function() {
    localeSvc.getTextPromise( 'ClassificationAdminMessages', true ).then( function( localTextBundle ) {
        _metric = localTextBundle.metric;
        _nonMetric = localTextBundle.nonMetric;
        _unspecified = localTextBundle.unspecified;
    } );
};

loadConfiguration();

/**
 * Modifies the unit system response for UI for Older Releases compatibility
 * @param {Object} metaData  metaData response
 */
export let modifyUnitSystemForNodesForOlderReleases = function( metaData ) {
    if( metaData[classifyAdminConstants.UNIT_SYSTEM] === 2 ) {
        metaData[classifyAdminConstants.UNIT_SYSTEM] = _metric + '/' + _nonMetric;
    } else if ( metaData[classifyAdminConstants.UNIT_SYSTEM] === 1 ) {
        metaData[classifyAdminConstants.UNIT_SYSTEM] = _nonMetric;
    } else {
        metaData[classifyAdminConstants.UNIT_SYSTEM] = _metric;
    }
};


/**
 * Modifies the unit system response for UI
 * @param {Object} metaData metaData response
 */
export let modifyUnitSystemForNodes = function( metaData ) {
    if( metaData[classifyAdminConstants.UNIT_SYSTEM] === 3 ) {
        metaData[classifyAdminConstants.UNIT_SYSTEM] = _metric + '/' + _nonMetric;
    } else if ( metaData[classifyAdminConstants.UNIT_SYSTEM] === 2 ) {
        metaData[classifyAdminConstants.UNIT_SYSTEM] = _nonMetric;
    } else if ( metaData[classifyAdminConstants.UNIT_SYSTEM] === 1 ) {
        metaData[classifyAdminConstants.UNIT_SYSTEM] = _metric;
    } else if ( !metaData[classifyAdminConstants.UNIT_SYSTEM] ) {
        metaData[classifyAdminConstants.UNIT_SYSTEM] = _unspecified;
    }
};

/**
 * Following method splits IRDI and provides individual values
 * @param {String} IRDI IRDI of object type
 * @return {ARRAY} IRDI tokens
 */
export let splitIRDI = function( IRDI ) {
    return IRDI.split( '#' );
};


/**
 * Creates cell for given table
 * @param {String} key Column name
 * @param {Object} value Field value for cell
 * @return {Object} temp2 Returns the cell object
 */
export let createCell = function( key, value ) {
    if( value === undefined || value === null ) {
        value = '';
    }
    var temp2 = {};
    temp2.name = key;
    //This prepares the data that needs to be used by the reference links.
    if( key === classifyAdminConstants.DATA_TYPE_REFERENCE ) {
        temp2.type = 'OBJECT';
        temp2.dbValue = value.toString();
        temp2.dbValues = [ temp2.dbValue ];
        temp2.href = temp2.dbValue;
        temp2.fielddata = {
            isEnabled: true,
            displayValues: value.toString(),
            uiValue: value.toString()
        };
        temp2.isLink = true;
    } else {
        temp2.type = 'STRING';
    }
    temp2.value = value.toString();
    temp2.uiValue = value.toString();
    return temp2;
};

/**
 * Special case, method to check version of Team-center release to get correct display names
 * @return {Boolean} true if supported, false otherwise
 * */
export let getSupportedVersion = function(  ) {
    return TcServerVersion.majorVersion === 14 && TcServerVersion.minorVersion >= 3;
};

/**
 * Following method gets display value for property. It honors L10n translations
 * @param {*} valueObj Supplied Object to look up for
 * @returns {String} Display Value
 */
export let getValue = function( valueObj ) {
    var value = '';

    if( valueObj !== undefined ) {
        value = valueObj;
    }

    if(  valueObj && valueObj.hasOwnProperty( classifyAdminConstants.VALUE_KEY ) ) {
        value = valueObj.Value;

        //Translate
        var translations = valueObj.Translations;
        if ( translations && translations.length > 0 ) {
            let idx = _.findIndex( translations, function( trn ) {
                //find translation for current locale
                return trn.Locale.substring( 0, 2 ) === _currentLocale;
            } );

            if ( idx !== -1 ) {
                //check if translation is approved
                var translation = translations[idx];
                if ( translation.TranslationStatus === classifyAdminConstants.TRANSLATION_APPROVED ) {
                    value = translation.Value;
                }
            }
        }
    }
    return value;
};

/**
 * Gets Javascript sub object
 * @param {*} object  Passed input objectriptors
 * @param {*} key key to search for within the object
 * @returns {Object} key
 */
export let getObjectAsPerKey = function( object, key ) {
    return object[key];
};


/**
 * Following method parses the SOA response and fetches the objectDefinitions
 * @param {String} refJson  JSON response
 * @param {String} type type of object
 * @param {String} classSystem  the class system being used.
 * @returns {Object} map of IRDI:Object entries
 */
export let parseJsonForObjectDefinitions = function( refJson, type, classSystem ) {
    var parsedJson = parsingUtils.parseJsonString( refJson );
    var objectDefinitions = parsedJson.ObjectDefinitions;
    var displayNames;
    let isSupported = getSupportedVersion();
    if ( isSupported ) {
        //14,3: DisplayNames are under respective descriptors
        if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_PROP ) {
            displayNames = parsedJson.PropertyDefinitionDescriptor;
        } else if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_KEYLOV ) {
            displayNames = parsedJson.KeyLOVDefinitionDescriptor;
        } else if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_CLASS ) {
            displayNames = parsedJson.ClassDefinitionDescriptor;
            if( !displayNames ) {
                displayNames = parsedJson.ClassDefinition_GroupDescriptor;
            }
        } else if ( type === classifyAdminConstants.JSON_REQUEST_TYPE_NODE ) {
            displayNames = parsedJson.NodeDefinitionDescriptor;
        }
    } else {
        displayNames = parsingUtils.parseJsonString( refJson ).DisplayNames;
    }

    var objectDefinitionsDisplayNames = objectDefinitions;
    if( displayNames !== undefined && objectDefinitionsDisplayNames !== undefined ) {
        objectDefinitionsDisplayNames.displayNames = displayNames;
        objectDefinitionsDisplayNames.descriptor = displayNames;
    }
    if( isSupported && objectDefinitionsDisplayNames ) {
        let formattedObj = {};
        var entries = Object.entries( objectDefinitionsDisplayNames );
        for( const [ classId, classAttrs ] of Object.entries( objectDefinitionsDisplayNames ) ) {
            // formattedObj[classId] = {};
            if( classSystem === classifyAdminConstants.CLASS_SYSTEM_ADVANCED ) {
                return objectDefinitionsDisplayNames;
            }
            //We are in basic.
            if( objectDefinitionsDisplayNames[classId].ClassAttributes ) {
                let classAttrs = objectDefinitionsDisplayNames[classId].ClassAttributes;
                _.forEach( classAttrs, function( classAttr ) {
                    classAttr.Reference = classAttr.AttributeId.toString();
                    classAttr.Type = classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_PROPERTY;
                    classAttr.IsDeprecated = false;
                } );
            }

            formattedObj = objectDefinitionsDisplayNames;
        }
        return formattedObj;
    }
    return objectDefinitionsDisplayNames;
};


/**
 * Following method parses the SOA response and fetches the objectDefinitions
 * @param {String} refJson  JSON response
 * @returns {Object} map of IRDI:Object entries
 */
export let parseJsonForAttrDefinitions = function( refJson ) {
    var parsedJson = parsingUtils.parseJsonString( refJson );
    var objectDefinitions = parsedJson.ObjectDefinitions;
    var displayNames;
    let isSupported = getSupportedVersion();
    if ( isSupported ) {
        //14,3: DisplayNames are under respective descriptors
        displayNames = parsedJson.PropertyDefinitionDescriptor;
    } else {
        displayNames = parsingUtils.parseJsonString( refJson ).DisplayNames;
    }
    var objectDefinitionsDisplayNames = objectDefinitions;
    if( displayNames !== undefined && objectDefinitionsDisplayNames !== undefined ) {
        objectDefinitionsDisplayNames.displayNames = displayNames;
    }
    return objectDefinitionsDisplayNames;
};


/**
 * Following method reads in the user's selected class system into the search state.
 * @param {State} searchState  the searchstate to update.
 * @param {String} classSystem  the class system that was switched to.
 */
export let updateClassificationSystem = function( searchState, classSystem ) {
    let tmpSearchState = { ...searchState.value };
    tmpSearchState.classSystem = classSystem;
    searchState.update( tmpSearchState );
};

/**
 * Following method parses the SOA response and fetches the parent details
 * @param {String} refJson  JSON response
 * @returns {Object} map of parent definitions
 */
export let parseJsonForParents = function( refJson ) {
    let out = parsingUtils.parseJsonString( refJson ).Result;
    let objects = [];
    _.forEach( out, function( results ) {
        let searchResults = results.SearchResults.Objects[0];
        objects.push( searchResults );
    } );

    return objects;
};


/**
* Following method parses the SOA response and fetches the KeyLOV definition
 * @param {String} refJson  JSON response
 * @returns {Object} KeyLOV definition
 */
export let parseJsonForKeyLOV = function( refJson ) {
    return parsingUtils.parseJsonString( refJson ).KeyLOVDefinitions;
};


/**
 * Returns image file tickets
 * @param {String} refJson JSON string
 * @return {ARRAY} images
 */
export let getImageFileTickets = function( refJson, type ) {
    var allObjects = parsingUtils.parseJsonString( refJson ).Result;
    var hasImages = false;
    var puid;

    if( allObjects[ 0 ].SearchResults && allObjects[ 0 ].SearchResults.Objects && allObjects[ 0 ].SearchResults.Objects.length > 0 ) {
        let imageTickets = allObjects[ 0 ].SearchResults.Objects[0].ImageFileTickets;

        if ( imageTickets && imageTickets.length > 0 ) {
            let tmpUid =  allObjects[ 0 ].SearchResults.Objects[0].puid.substring( 0, 14 );
            hasImages = true;
            puid = {
                selectionData:{
                    value:{
                        selected : [ {
                            uid : tmpUid
                        } ]
                    }
                }
            };
        }
    }

    return {
        hasImages: hasImages,
        puid:  puid
    };
};

/**
 * Following method changes display mode to Summary View layout
 * @param {*} refJson JSON string
 * @param {String} type object type
 * @param {Boolean} isSummary true of summary, false otherwise
 * @param {Boolean} isSearch true of summary, false otherwise
 * @returns {String} JSON string
 */
export let parseJson = function( refJson, type, isSummary, isSearch ) {
    var typeObjects = [];
    var allObjects =  parsingUtils.parseJsonString( refJson ).Result;
    if ( type === classifyAdminConstants.PROPERTIES ) {
        typeObjects = allObjects[ 0 ].SearchResults;
    } else if ( type === classifyAdminConstants.KEYLOV ) {
        typeObjects = isSummary ? allObjects[ 1 ].SearchResults : allObjects[ 0 ].SearchResults;
    } else if ( type === classifyAdminConstants.CLASSES ) {
        typeObjects = isSummary ? allObjects[ 2 ].SearchResults : allObjects[ 0 ].SearchResults;
    } else if ( type === classifyAdminConstants.NODES ) {
        typeObjects = isSummary ? allObjects[ 3 ].SearchResults : allObjects[ 0 ].SearchResults;
    } else if( type === 'Attributes' ) {
        //both class definition and property definition may exists
        typeObjects = allObjects[ 0 ].SearchResults;
        if( allObjects.length > 1 ) {
            typeObjects = allObjects[ 0 ].SearchResults;
            var typeObjects2 = allObjects[ 1 ].SearchResults;

            var newObjects = typeObjects2.Objects.concat( typeObjects.Objects );
            var typeObjects3 = {
                ObjectType: 'Attribute',
                Objects: newObjects,
                totalFound: newObjects.length,
                totalLoaded: newObjects.length
            };
            typeObjects = typeObjects3;
        }
    } else if ( type === 'AttributesPanel' ) {
        //both class definition and property definition may exists
        //check length of allObjects
        if( allObjects.length > 0 ) {
            if( allObjects.length > 1 ) {
                typeObjects = allObjects[ 0 ].SearchResults;
                var typeObjects2 = allObjects[ 1 ].SearchResults;
                var newObjects = typeObjects2.Objects.concat( typeObjects.Objects );
                var typeObjects3 = {
                    ObjectType: 'AttributesPanel',
                    Objects: newObjects,
                    totalFound: newObjects.length,
                    totalLoaded: newObjects.length
                };

                typeObjects = typeObjects3;
            }else{
                typeObjects = allObjects[ 0 ].SearchResults;
            }
        }
    }
    return {
        objects: typeObjects.Objects,
        totalFound: typeObjects.totalFound,
        totalLoaded: typeObjects.totalLoaded,
        parents: isSearch ? typeObjects.Parents : undefined
    };
};
/**
 * This method creates links that can be clicked to open the related object's information in a separate panel.
 * @param {ViewModelObject} vmo the view model object of the table being used.
 * @param {HTMLElement} containerElement the direct HTML elements in the table to be modified.
 * @param {String} columnField which column's properties we want to modify.
 */
export let adminCustomRefLinksRender = function( vmo, containerElement, columnField ) {
    const attrType = vmo.props[classifyAdminConstants.CLASS_ATTRIBUTE_TYPE].value;
    var labelText = document.createElement( 'div' );
    labelText.textContent = vmo.props[columnField].uiValue;
    labelText.classList.add( 'aw-splm-tableHeaderCellLabel' );
    labelText.classList.add( 'aw-clsClassesSecWorkArea-verticalHeaderText' );
    let dataTypeReference = classifyAdminConstants.DATA_TYPE + classifyAdminConstants.DATA_TYPE_BLOCKREFERENCE;
    let dataTypeKeyLov = classifyAdminConstants.DATA_TYPE + classifyAdminConstants.DATA_TYPE_KEYLOV;
    let hasLink = false;
    if ( vmo.props[ dataTypeReference ] || vmo.props[ dataTypeKeyLov ] ) {
        hasLink = true;
    }
    if( attrType === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_ASPECT || attrType === classifyAdminConstants.CLASS_ATTRIBUTE_TYPE_BLOCK ||
        hasLink ) {
        labelText.style.cursor = 'pointer';
        labelText.style.color = 'blue';
        labelText.style['text-decoration'] = 'underline';
        labelText.onclick = () => {
            //Potential issue if type is in non-english language.
            let eventData = {
                linkId: labelText.textContent,
                type: attrType
            };
            eventBus.publish( 'classifyAdmin.linkClicked', eventData );
        };
    }
    containerElement.appendChild( labelText );
};

export let destroyKeylovTreeInfo = function( dataProvider ) {
    dataProvider.update( [], 0 );
};

export default exports = {
    adminCustomRefLinksRender,
    createCell,
    destroyKeylovTreeInfo,
    getImageFileTickets,
    getObjectAsPerKey,
    getSupportedVersion,
    getValue,
    modifyUnitSystemForNodes,
    modifyUnitSystemForNodesForOlderReleases,
    parseJson,
    parseJsonForAttrDefinitions,
    parseJsonForParents,
    parseJsonForKeyLOV,
    parseJsonForObjectDefinitions,
    updateClassificationSystem,
    splitIRDI
};
