// Copyright (c) 2022 Siemens

/**
 * @module js/Arm0CompareHistoryService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import commandSvc from 'js/command.service';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import eventBus from 'js/eventBus';
import viewModelObjectSvc from 'js/viewModelObjectService';
import iconSvc from 'js/iconService';
import _ from 'lodash';
import compareUtils from 'js/Arm0CompareUtils';
import localeService from 'js/localeService';
import reqUtils from 'js/requirementsUtils';
import { svgString as changeAdded } from 'image/indicatorLegendCompareAdded16.svg';
import { svgString as changeRemoved } from 'image/indicatorLegendCompareRemoved16.svg';
import { svgString as changeFormatted } from 'image/indicatorLegendCompareFormatted16.svg';

var exports = {};
var selectedFullTextObjects;
var _reqHistoryCompareContentEventListener;
let uniqueIdMap = new Map();

var TC_MICRO_PREFIX = 'tc/micro';
var RM_COMPARE_HISTORY = '/req_compare/v1/compare/history';

/**
 * @param {IModelObject} htmlData - compare html data
 */
export let showHtmlCompareReport = function( htmlData, data ) {
    var divs = document.getElementsByClassName( 'aw-richtexteditor-documentPaper' );
    if ( divs && divs.length > 0 ) {
        // Wrapping contents in divs to look it like a Documentation tab
        var requirementDiv = document.createElement( 'div' );
        var contentDiv = document.createElement( 'div' );
        var bodyTextDiv = document.createElement( 'div' );
        contentDiv.appendChild( bodyTextDiv );
        requirementDiv.appendChild( contentDiv );

        var datahtml = compareUtils.addSpansInContent( htmlData, data );
        bodyTextDiv.innerHTML = reqUtils.addCssInContents( datahtml );
        divs[0].innerHTML = requirementDiv.outerHTML;
    }
};

/**
 * @param {Object} data - View model data
 */
export let showCompareVersionHistory = function( ) {
    return { compareHtmlData : null,
        selectedFullText:null };
};

/**
 * Return the url for compare history microservice
 * @returns {String} url
 */
export let getCompareHistoryServiceURL = function() {
    return browserUtils.getBaseURL() + TC_MICRO_PREFIX + RM_COMPARE_HISTORY;
};

/**
 * Return the url for compare html microservice
 * @returns {String} url
 */
export let getCompareHtmlServiceURL = function() {
    return compareUtils.getCompareHtmlServiceURL();
};

/**
 * Return FMS base url
 * @returns {String} url
 */
export let getFmsBaseURL = function() {
    return browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
};

/**
 * Returns the dummy input context object including fms base url in requestPref
 * @returns {Object} Input context object
 */
export let getDefaultInputContext = function() {
    return {
        configuration: {
            revisionRule: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            effectivityDate: '',
            now: false,
            endItem: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            unitNo: 0,
            variantRule: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            configurationObject: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            svrOwningProduct: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            }
        },
        pageSize: 0,
        structureContextObject: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        },
        productContext: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        },
        requestPref: { base_url: exports.getFmsBaseURL() }
    };
};

export let getMicroserviceURL = function() {
    return browserUtils.getBaseURL() + 'tc/micro/ReqExport/v1/api/export/exportDocument';
};

export let processResponse = function( response ) {
    fmsUtils.openFile( response.data.fmsTicket, response.data.fileName );
};

var processLegendsSpan = function( changeType, legendSpan  ) {
    let legendElemntLabel = document.createElement( 'span' );
    legendElemntLabel.innerText = ' ' + changeType;
    legendElemntLabel.innerHTML = ' ' + changeType;
    legendSpan.appendChild( legendElemntLabel );
};

export let preProcessHTMLContentAndExport = () => {
    var compareReqHistoryReport = document.getElementsByClassName( 'aw-requirements-compareReqHistory' );
    let htmlToBeExported = compareReqHistoryReport[ 0 ].innerHTML;

    let temp = document.createElement( 'html' );
    temp.innerHTML = htmlToBeExported;

    Array.prototype.slice.call( temp.getElementsByTagName( 'button' ) ).forEach( function( item ) {
        item.parentNode.removeChild( item );
    } );

    let allHeaderElements = temp.getElementsByTagName( 'h3' );
    let l = allHeaderElements.length;
    for( let i = 0; i < l; i++ ) {
        let el = allHeaderElements[ i ];
        let newHeader1 = document.createElement( 'div' );
        newHeader1.className = 'aw-compareHistory-header1';
        let orginalHeader1;
        if( el && el.childNodes[ 0 ] ) {
            newHeader1.innerHTML = el.childNodes[ 0 ].innerHTML;
            orginalHeader1 = el.childNodes[ 0 ];
            el.replaceChild( newHeader1, orginalHeader1 );
        }

        let newHeader2 = document.createElement( 'div' );
        newHeader2.className = 'aw-compareHistory-header2';
        let orginalHeader2;
        if( el && el.childNodes[1] ) {
            newHeader2.innerHTML = el.childNodes[ 1 ].innerHTML;
            orginalHeader2 = el.childNodes[ 1 ];
            newHeader2.style.fontSize = '10pt';
            el.replaceChild( newHeader2, orginalHeader2 );
        }
    }

    let legendItem1 = temp.getElementsByClassName( 'aw-requirement-chip' );
    let legendItem = temp.getElementsByClassName( 'aw-requirement-legendItem' );
    let legendSpan = document.createElement( 'span' );
    let localTextBundle = localeService.getLoadedText( 'RequirementsCommandPanelsMessages' );
    for( let i = 0; i < legendItem.length; i++ ) {
        if( legendItem[ i ].outerText === localTextBundle.added ) {
            let spanForAdd = document.createElement( 'span' );
            spanForAdd.innerHTML = changeAdded;
            legendSpan.appendChild( spanForAdd );
            processLegendsSpan( localTextBundle.added, legendSpan  );
        } else if( legendItem[ i ].outerText === localTextBundle.removed ) {
            let spanForRemove = document.createElement( 'span' );
            spanForRemove.innerHTML = ' ' + changeRemoved;
            // spanForRemove.style.marginRight = '15px';
            legendSpan.appendChild( spanForRemove );
            processLegendsSpan( localTextBundle.removed, legendSpan  );
        } else if( legendItem[ i ].outerText === localTextBundle.modified ) {
            let spanForFormat = document.createElement( 'span' );
            spanForFormat.innerHTML = ' ' + changeFormatted;
            // spanForFormat.style.marginRight = '15px';
            legendSpan.appendChild( spanForFormat );
            processLegendsSpan( localTextBundle.modified, legendSpan  );
        }
    }
    legendItem1[ 0 ].replaceChild( legendSpan, legendItem1[ 0 ].childNodes[ 0 ] );
    return temp.innerHTML;
};

/**
 * Return the array of body_text for the selected fullText versions
 *
 * @param {Object} fullTextCompareDataListDataProvider - fulltext data provider
 * @returns {Array} array of body_text html string
 */
export let getSelectedObjectsHtml = function( fullTextCompareDataListDataProvider ) {
    var selectedIndexArray = fullTextCompareDataListDataProvider.getSelectedIndexes();
    if ( selectedIndexArray.length === 2 ) {
        // Get the selected fulltext objects
        var fullText_1 = fullTextCompareDataListDataProvider.getItemAtIndex( selectedIndexArray[0] );
        var fullText_2 = fullTextCompareDataListDataProvider.getItemAtIndex( selectedIndexArray[1] );

        // Store the selections for further use
        selectedFullTextObjects = [];
        selectedFullTextObjects.push( fullText_1 );
        selectedFullTextObjects.push( fullText_2 );

        // Get the html content data for the selected objects
        var html_1 = fullText_1.props[4].propValues[0];
        var html_2 = fullText_2.props[4].propValues[0];

        // Construct the object string for the selected fulltext version
        // TODO - need better solution for this
        var rev_1_ObjectString = fullText_1.props[5].propValues[0];
        var start_1 = rev_1_ObjectString.substring( 0, rev_1_ObjectString.indexOf( ';' ) + 1 );
        var lastPart1 = rev_1_ObjectString.substring( rev_1_ObjectString.indexOf( ';' ) );
        var start_2 = lastPart1.substring( lastPart1.indexOf( '-' ) );
        var rev_1_VersionNumber = fullText_1.props[3].propValues[0];
        var revFullTextVersionObjectString_1 = start_1 + rev_1_VersionNumber + start_2;

        var rev_2_ObjectString = fullText_2.props[5].propValues[0];
        var start_11 = rev_2_ObjectString.substring( 0, rev_2_ObjectString.indexOf( ';' ) + 1 );
        var lastPart2 = rev_2_ObjectString.substring( rev_2_ObjectString.indexOf( ';' ) );
        var start_22 = lastPart2.substring( lastPart2.indexOf( '-' ) );
        var rev_2_VersionNumber = fullText_2.props[3].propValues[0];
        var revFullTextVersionObjectString_2 = start_11 + rev_2_VersionNumber + start_22;

        var ctxSpecData = {
            Obj1: revFullTextVersionObjectString_1,
            Obj2: revFullTextVersionObjectString_2
        };

        appCtxSvc.updateCtx( 'Arm0RequirementHistoryContext.selectedFullText', ctxSpecData );

        showHistoryLabel( revFullTextVersionObjectString_1, revFullTextVersionObjectString_2 );
        return [
            html_1,
            html_2
        ];
    }
};

var showHistoryLabel = function( Obj1, Obj2 ) {
    var resource = 'RequirementsCommandPanelsMessages';
    var localTextBundle = localeService.getLoadedText( resource );
    var comparingToLabel = localTextBundle.comparingTo;
    var historyLabel = comparingToLabel.replace( '{0}', Obj1 );
    historyLabel = historyLabel.replace( '{1}', Obj2 );
    appCtxSvc.registerCtx( 'Arm0RequirementHistoryContextCompareToMsg', historyLabel );
};

/**
 * Subscribe an events
 */
export let subscribeEvents = function() {
    if ( !_reqHistoryCompareContentEventListener ) {
        _reqHistoryCompareContentEventListener = eventBus.subscribe( 'Arm0RequirementHistory.backToCompareVersionHistory', function() {
            eventBus.publish( 'Arm0RequirementHistory.showCompareVersionHistory' );
        }, 'Arm0CompareHistoryService' );
    }
};

/**
 * Unsubscribe events
 */
export let unsubscribeEvents = function() {
    if ( _reqHistoryCompareContentEventListener ) {
        eventBus.unsubscribe( _reqHistoryCompareContentEventListener );
        _reqHistoryCompareContentEventListener = null;
    }
};

/**
 * Function to compare to selected requirement specification versions
 *  @param {Object} fullTextCompareDataListDataProvider - fulltext data provider
 * @param {Object} data - data
 */
export let compareReqSpecRevisions = function( fullTextCompareDataListDataProvider, data ) {
    var selectedIndexArray = fullTextCompareDataListDataProvider.getSelectedIndexes();
    if ( selectedIndexArray.length === 2 ) {
        // Get the selected fulltext objects
        var fullText_1 = fullTextCompareDataListDataProvider.getItemAtIndex( selectedIndexArray[0] );
        var fullText_2 = fullTextCompareDataListDataProvider.getItemAtIndex( selectedIndexArray[1] );

        var specRev1 = {
            uid: fullText_1.uid,
            type: fullText_1.type,
            props: fullText_1.props
        };
        var specRev2 = {
            uid: fullText_2.uid,
            type: fullText_2.type,
            props: fullText_2.props
        };

        var objects = [
            specRev1,
            specRev2
        ];

        var rev_1_Revision = fullText_1.props.revision.propValues[0];
        var rev_1_VersionNumber = fullText_1.props.versionNumber.propValues[0];
        var revFullTextVersionObjectString_1 = data.i18n.revision + '\n' + rev_1_Revision + ';' + '\n' + data.i18n.versionNumber + '\n' + rev_1_VersionNumber;

        var rev_2_Revision = fullText_2.props.revision.propValues[0];
        var rev_2_VersionNumber = fullText_2.props.versionNumber.propValues[0];
        var revFullTextVersionObjectString_2 = data.i18n.revision + '\n' + rev_2_Revision + ';' + '\n' + data.i18n.versionNumber + '\n' + rev_2_VersionNumber;

        // Add objects in the ctx to be shown on the comparingTo label
        if ( specRev1 && specRev1.props && specRev1.props.object_string && specRev2 && specRev2.props && specRev2.props.object_string ) {
            var ctxSpecData = {
                selectedSpecRevs: {
                    Obj1: revFullTextVersionObjectString_1,
                    Obj2: revFullTextVersionObjectString_2
                }
            };
            appCtxSvc.updatePartialCtx( 'Arm0ReqSpecVersionHistoryContext.selectedSpecRevs', ctxSpecData );
            showHistoryLabel( revFullTextVersionObjectString_1, revFullTextVersionObjectString_2 );
        }
        eventBus.publish( 'Arm0RequirementHistory.getSpecContentData', objects );
    }
};

/**
 * Function to compare to selected requirement specification revisions
 * @param {Object} ctx - context
 */
export let compareSpecRevisions = function( ctx ) {
    if ( ctx.mselected.length === 2 ) {
        var specRev1 = ctx.mselected[0];
        var specRev2 = ctx.mselected[1];

        var objects = [
            specRev1,
            specRev2
        ];

        // Add objects in the ctx to be shown on the comparingTo label
        if ( specRev1 && specRev1.props && specRev1.props.object_string && specRev2 && specRev2.props && specRev2.props.object_string ) {
            var ctxSpecData = {
                selectedSpecRevs: {
                    Obj1: specRev1.props.object_string.displayValues[0],
                    Obj2: specRev2.props.object_string.displayValues[0]
                }
            };
            appCtxSvc.updateCtx( 'Arm0RequirementSpecHistoryContext', ctxSpecData );
            showHistoryLabel( specRev1.props.object_string.displayValues[0], specRev2.props.object_string.displayValues[0] );
        }
        eventBus.publish( 'Arm0RequirementHistory.getSpecContentData', objects );
    }
};

/**
 * Pre-process the html spec contents before comparing,
 * Remove un-necessary attributes from html contents.
 *
 * @param {Array} htmlContents - html content array
 * @return {Array} processed html content array
 */
export let preProcessSpecContents = function( data, isReqSpecVersionHistory ) {
    var processedHtmlContents = [];
    var mapOfVerAndRev = [];
    var htmlContents = data.htmlContents;
    for ( let index = 0; index < htmlContents.length; index++ ) {
        var content = htmlContents[index];
        if ( content ) {
            var contentDivElement = document.createElement( 'div' );
            contentDivElement.innerHTML = content;

            // Get requirement divs
            var requirementDivs = contentDivElement.getElementsByClassName( 'requirement' );
            for ( let i = 0; i < requirementDivs.length; i++ ) {
                const reqElement = requirementDivs[i];
                reqElement.removeAttribute( 'id' );
                reqElement.removeAttribute( 'revId' );
                reqElement.removeAttribute( 'lmd' );
                reqElement.removeAttribute( 'parentid' );
            }

            //Remove extra span added in header and create map out of it.
            if( isReqSpecVersionHistory ) {
                var h3Element = contentDivElement.getElementsByTagName( 'h3' );
                for( let i = 0; i < h3Element.length; i++ ) {
                    var spanElements = h3Element[i].getElementsByTagName( 'span' );
                    var splittedSpan = spanElements[0].innerText.split( '-' );
                    if( spanElements.length > 1 ) {
                        uniqueIdMap.set( splittedSpan[1], spanElements[1].innerText );
                        spanElements[1].remove();
                    }
                }
                mapOfVerAndRev.push( uniqueIdMap );
                uniqueIdMap = new Map();
            }
            processedHtmlContents.push( contentDivElement.innerHTML );
        }
    }
    return { processedHtmlContents:processedHtmlContents,
        mapOfVerAndRev: mapOfVerAndRev };
};

/**
 * Funcation to show the compare result for the specification
 * @param {IModelObject} htmlData - compare html data
 */
export let showSpecCompareReport = function( htmlData ) {
    var divs = document.getElementsByClassName( 'aw-richtexteditor-documentPaper' );
    if ( divs && divs.length > 0 ) {
        // Find section element
        var historySectionElement = _getPanelSectionElement( divs[0] );

        if ( historySectionElement ) {
            // Find objectset element to hide before showing compare report
            var objectsetElements = historySectionElement.getElementsByTagName( 'aw-walker-objectset' );
            if ( objectsetElements && objectsetElements[0] ) {
                objectsetElements[0].style.display = 'none';
            }

            // Set compare html content
            divs[0].innerHTML = reqUtils.addCssInContents( htmlData );
        }
    }
};

/**
 * Return the panel section element
 * @param {Object} element - html element
 * @returns {Object} element
 */
var _getPanelSectionElement = function( element ) {
    if ( element && element.classList && element.classList.contains( 'aw-layout-panelSectionContent' ) ) {
        return element;
    }
    return _getPanelSectionElement( element.parentElement );
};

/**
 * Function to show revision list
 * @param {Object} data - panel view model data
 */
export let showSpecRevisionList = function( data ) {
    appCtxSvc.updateCtx( 'Arm0RequirementSpecHistoryContext', {} );

    var divs = document.getElementsByClassName( 'aw-richtexteditor-documentPaper' );
    if ( divs && divs.length > 0 ) {
        // Find section element
        var historySectionElement = _getPanelSectionElement( divs[0] );

        if ( historySectionElement ) {
            // Find objectset element to Show
            var objectsetElements = historySectionElement.getElementsByTagName( 'aw-walker-objectset' );
            if ( objectsetElements && objectsetElements[0] ) {
                objectsetElements[0].style.display = '';
            }
        }
    }
    return{ compareHtmlData:null };
};

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
export let execute = function( vmo ) {
    if( vmo && vmo.uid ) {
        var modelObject = cdm.getObject( vmo.props.uid.propValues[0] );
    }

    var commandContext = {
        vmo: modelObject || vmo, // vmo needed for gwt commands
        edit: false
    };

    commandSvc.executeCommand( 'Awp0ShowObjectCell', null, null, commandContext );
};

/**
 * Process response for creating vmo object
 *
 * @param {Object} response - The soa response
 */
export let processReqSpecHistory = function( response, data ) {
    var cellObjects = [];
    var sortCriteria = data.columnProviders.ReqSpecHistoryColumnProvider.sortCriteria;
    if ( response.revToFullText ) {
        var revToFullText = response.revToFullText;
        var propertyValues = response.objectPropValues;
        var fullTextRevisionsArray = revToFullText[1]; // Array of full text versions of revision
        var revisions = revToFullText[0]; // Revisions of requirement
        _.forEach( revisions, function( reqRevision ) {
            var type = reqRevision.type;
            var iconURL = iconSvc.getTypeIconURL( type );
            var uid = reqRevision.uid;
            var revisionIndex = _.findIndex( propertyValues[0], { uid: reqRevision.uid } );
            var revisionIndexInRevisions = _.findIndex( revisions, { uid: reqRevision.uid } ); // Find index of revision
            var selFullTextRevs = fullTextRevisionsArray[revisionIndexInRevisions]; // Get that indexs fulltext versions
            _.forEach( selFullTextRevs, function( fullTextVersion ) {
                var vmObject = viewModelObjectSvc.constructViewModelObjectFromModelObject( fullTextVersion, iconURL );
                vmObject.typeIconURL = iconURL;
                var properties = {};
                var index = _.findIndex( propertyValues[0], { uid: fullTextVersion.uid } ); // Full text version
                var propValues = propertyValues[1];
                var prop = propValues[index];
                var revisionProp = propValues[revisionIndex];
                var propertyDescriptorsMap = fullTextVersion.modelType.propertyDescriptorsMap;
                var versionNumber = _.find( prop, { propName: propertyDescriptorsMap.revision_number.displayName } );
                var dateModified = _.find( prop, { propName: propertyDescriptorsMap.last_mod_date.displayName } );
                var modifyingUser = _.find( prop, { propName: propertyDescriptorsMap.last_mod_user.displayName } );
                var owner = _.find( prop, { propName: propertyDescriptorsMap.owning_user.displayName } );
                var bodytext = _.find( prop, { propName: propertyDescriptorsMap.body_text.name } );
                var cellProp = _.find( revisionProp, { propName: propertyDescriptorsMap.object_string.displayName } );
                var revision = _.find( revisionProp, { propName: propertyDescriptorsMap.rev_prop.displayName } );

                properties.object_string = _createProp( 'Object', cellProp.propValues[0], 'STRING', 'Object Name' );
                properties.type = _createProp( 'Object', type, 'STRING', 'Type' );
                properties.revision = _createProp( 'revision', revision.propValues[0], 'STRING', 'Revision' );
                properties.versionNumber = _createProp( 'Version Number', versionNumber.propValues[0], 'STRING', 'Version Number' );
                properties.owner = _createProp( 'Owner', owner.propValues[0], 'STRING', 'Owner' );
                properties.dateModified = _createProp( 'Date Modified', dateModified.propValues[0], 'STRING', 'Date Modified' );
                properties.modifyingUser = _createProp( 'Last Modifying User', modifyingUser.propValues[0], 'STRING', 'Last Modifying User' );
                properties.bodytext = _createProp( 'body_text', bodytext.propValues[0], 'STRING', 'Body Text' );
                properties.uid = _createProp( 'Object', uid, 'STRING', 'UID' );
                vmObject.props = properties;
                cellObjects.push( vmObject );
            } );
        } );
        return applySort( cellObjects, sortCriteria );
    }
    return cellObjects;
};

/**
 * This function is responsible for sorting of the data.

 * @param {Object} sortCriteria Sort criteria
 * @param {Object} cellObjects array of cell objects
 *
 * @return {ObjectArray}  paginated sorted result
 */
var applySort = function( cellObjects, sortCriteria ) {
    var cellObjects = cellObjects;

    if ( sortCriteria && sortCriteria.length > 0 ) {
        var criteria = sortCriteria[0];
        var sortDirection = criteria.sortDirection;
        var sortColName = criteria.fieldName;

        if ( sortColName === 'dateModified' ) {
            var dateobj;
            var dateTimeParts;
            var timeParts;
            var dateParts;
            var date;
            var timestamp;
            for ( var obj = 0; obj < cellObjects.length; obj++ ) {
                dateobj = cellObjects[obj].props.dateModified.propValues[0];
                var dt = new Date( dateobj );
                dateTimeParts = dateobj.split( ' ' );
                timeParts = dateTimeParts[1].split( ':' );
                dateParts = dateTimeParts[0].split( '-' );
                var month = dt.getMonth();
                date;

                date = new Date( dateParts[2], parseInt( month, 10 ), dateParts[0], timeParts[0], timeParts[1] );

                cellObjects[obj].props.dateModified.propValues[0] = date.getTime();
            }
        }
        if ( sortColName === 'versionNumber' ) {
            // Version number needs to be compared as Integer - LCS-631852
            for ( var obj = 0; obj < cellObjects.length; obj++ ) {
                var intObj = cellObjects[obj].props.versionNumber.propValues[0];
                cellObjects[obj].props.versionNumber.propValues[0] = parseInt( intObj );
            }
        }
        // Apply sort
        if ( sortDirection === 'ASC' ) {
            cellObjects.sort( function( a, b ) {
                if ( a.props[sortColName].propValues[0] <= b.props[sortColName].propValues[0] ) {
                    return -1;
                }
                return 1;
            } );
        } else if ( sortDirection === 'DESC' ) {
            cellObjects.sort( function( a, b ) {
                if ( a.props[sortColName].propValues[0] >= b.props[sortColName].propValues[0] ) {
                    return -1;
                }

                return 1;
            } );
        }
    }
    // Make a list of each revision
    var sortedData = [];
    var rev = [];
    rev.push( cellObjects[0].props.revision.uiValue );
    for ( var k = 0; k < rev.length; k++ ) {
        for ( var j = 0; j < cellObjects.length; j++ ) {
            if ( cellObjects[j].props.revision.uiValue === rev[k] ) {
                sortedData.push( cellObjects[j] );
            } else {
                var index = rev.findIndex( x => x === cellObjects[j].props.revision.uiValue );
                if ( index === -1 ) {
                    rev.push( cellObjects[j].props.revision.uiValue );
                }
            }
        }
    }
    return sortedData;
};

var _createProp = function( propName, propValue, type, propDisplayName ) {
    return {
        type: type,
        hasLov: false,
        isArray: false,
        displayValue: [ propValue ],
        uiValue: propValue,
        propValues: [ propValue ],
        propertyName: propName,
        propertyDisplayName: propDisplayName,
        isEnabled: true
    };
};


/**
 * Publishes event to call function for swapping compared objects
 */
export let swapComparedObjects = function() {
    eventBus.publish( 'Arm0ReqSpecVersionHistory.swapComparisonObjects' );
};

/**
 ** @param {Object} fullTextCompareDataListDataProvider - fulltext data provider
 */
export let swapComparisonObjects = function( data ) {
    var mapOfVerAndRev;
    var htmlContents = [
        data.htmlContents[1],
        data.htmlContents[0]
    ];

    if( data.mapOfVerAndRev ) {
        mapOfVerAndRev = [
            data.mapOfVerAndRev[1],
            data.mapOfVerAndRev[0]
        ];
    }


    var aceActiveContext = appCtxSvc.getCtx( 'Arm0ReqSpecVersionHistoryContext.selectedSpecRevs' );
    var obj1 = aceActiveContext.selectedSpecRevs.Obj1.split( ';' );
    var rev_1_Revision = obj1[0];
    var rev_1_VersionNumber  = obj1[1];

    var obj2 = aceActiveContext.selectedSpecRevs.Obj2.split( ';' );
    var rev_2_Revision = obj2[0];
    var rev_2_VersionNumber  = obj2[1];

    var revFullTextVersionObjectString_1 = rev_1_Revision + ';' + '\n'  + rev_1_VersionNumber;
    var revFullTextVersionObjectString_2 = rev_2_Revision + ';' + '\n' + rev_2_VersionNumber;

    showHistoryLabel( revFullTextVersionObjectString_2, revFullTextVersionObjectString_1 );
    var temp =  aceActiveContext.selectedSpecRevs.Obj1;
    aceActiveContext.selectedSpecRevs.Obj1 = aceActiveContext.selectedSpecRevs.Obj2;
    aceActiveContext.selectedSpecRevs.Obj2 = temp;

    appCtxSvc.updateCtx( 'Arm0ReqSpecVersionHistoryContext.selectedSpecRevs', aceActiveContext );
    eventBus.publish( 'Arm0RequirementHistory.setHtmlContents', { htmlContents:htmlContents, mapOfVerAndRev:mapOfVerAndRev } );
};

/**
 * Render compared html content
 */
export let renderCompareContent = function( vmo ) {
    setTimeout( () => {
        var contentElement = document.getElementById( vmo.uid );
        if( contentElement ) {
            contentElement.innerHTML = reqUtils.addCssInContents( vmo.props[ 9 ].propValues[ 0 ] );
        }
    }, 100 );
};

export let setHtmlContents = function( htmlContents, mapOfVerAndRev ) {
    return{ mapOfVerAndRev:mapOfVerAndRev,
        htmlContents:htmlContents };
};

/**
 * Service for comparing Requirement contents.
 *
 * @member Arm0CompareHistoryService
 * @param {Object} appCtxSvc -
 * @returns {Object} exports
 */

export default exports = {
    showHtmlCompareReport,
    showCompareVersionHistory,
    getCompareHistoryServiceURL,
    getCompareHtmlServiceURL,
    getFmsBaseURL,
    getDefaultInputContext,
    getSelectedObjectsHtml,
    subscribeEvents,
    unsubscribeEvents,
    compareSpecRevisions,
    preProcessSpecContents,
    showSpecCompareReport,
    showSpecRevisionList,
    execute,
    processReqSpecHistory,
    compareReqSpecRevisions,
    applySort,
    swapComparedObjects,
    swapComparisonObjects,
    renderCompareContent,
    setHtmlContents,
    preProcessHTMLContentAndExport,
    getMicroserviceURL,
    processResponse
};
