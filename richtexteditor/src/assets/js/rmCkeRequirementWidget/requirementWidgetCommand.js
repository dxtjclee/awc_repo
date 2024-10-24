// Copyright (c) 2020 Siemens

/* eslint-disable complexity */
import RequirementWidgetUtil from 'js/rmCkeRequirementWidget/requirementWidgetUtil';
import localeService from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
//do not remove this import. This import is required to do a iniitialization
import 'js/addElementTypeHandler';
import _ from 'lodash';

var cacheCommentsPositionMap = new Map();

export default class RequirementWidgetCommand extends ckeditor5ServiceInstance.Command {
    /**
     * Create and add new widget
     *
     * @param {Object} widgetMetaData
     */
    _createNewWidget( widgetMetaData ) {
        const editor = this.editor;

        var parentRequirement = widgetMetaData.parentWidget;
        var requirement;
        var resource = 'RequirementsCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );

        // eslint-disable-next-line complexity
        editor.model.change( writer => {
            var insertPosition = null;
            var preferedTemplate = widgetMetaData.preferedTemplate;

            const viewFragment = editor.data.processor.toView( preferedTemplate );
            const modelFregment = editor.data.toModel( viewFragment );

            if ( !modelFregment || modelFregment.childCount < 1 ) { return; }

            const templateRequirement = modelFregment.getChild( 0 );

            requirement = writer.createElement( 'requirement', {
                class: 'requirement',
                parentid: parentRequirement.getAttribute( 'id' ),
                itemtype: 'Requirement',
                objecttype: 'Requirement',
                parenttype: parentRequirement.getAttribute( 'itemtype' ),
                id: getRandomId()
            } );
            if ( widgetMetaData.siblingId ) {
                writer.setAttribute( 'siblingid', widgetMetaData.siblingId, requirement );
                writer.setAttribute( 'siblingtype', widgetMetaData.siblingType, requirement );
            }
            if ( widgetMetaData.isChild ) {
                widgetMetaData.parentWidget.createdChildElements.push( requirement );
            }
            if ( widgetMetaData.isSibling ) {
                widgetMetaData.parentWidget.createdSiblingElements.unshift( requirement );
            }
            writer.setAttribute( 'parentid', widgetMetaData.parentId, requirement );
            writer.setAttribute( 'parenttype', widgetMetaData.parentType, requirement );
            writer.setAttribute( 'parentitemtype', widgetMetaData.parentItemType, requirement );

            var tempString = _getRequirementHeaderElement( parentRequirement ).getAttribute( 'requirementNamePrefix' );
            var sequence = tempString.split( ' ', 1 );
            var widgetData = editor.model.document.getRoot();
            var parentIdOfCurrentElement;
            var sequence2;
            var htmlString;
            var selectedWidget;
            const requirementHeader = writer.createElement( 'requirementHeader', { requirementNamePrefix: '' } );
            var requirementContent;
            var requirementBodyText;
            var session = appCtxSvc.getCtx( 'userSession' );
            var userId;
            if ( session ) {
                userId = session.props.user_id.dbValues[0];
            }

            if ( editor.isHtmlSpecTemplate === true ) {
                requirementContent = writer.createElement( 'requirementContent' );
                requirementBodyText = writer.createElement( 'requirementBodyText', { class: 'aw-requirement-bodytext' } );
                let paraTemp = writer.createElement( 'paragraph' );
                writer.insert( paraTemp, writer.createPositionAt( requirementBodyText, 0 ) );
                writer.insert( requirementBodyText, writer.createPositionAt( requirementContent, 0 ) );
            } else {
                requirementContent = RequirementWidgetUtil.getModelElement( editor, templateRequirement, 'requirementContent' );
                requirementBodyText = RequirementWidgetUtil.getModelElement( editor, requirementContent, 'requirementBodyText' );
            }
            writer.setAttribute( 'isDirty', userId, requirementHeader );


            // Calculate the comment positions if present in the selection
            if( editor.SPLITREQ ) {
                _calculateCommentPositionPresentInSelection( editor );
            }

            // If Clicked on Add Child
            if ( widgetMetaData.isChild ) {
                //Get content from clipboard in case of split requirement
                if ( editor.SPLITREQ ) {
                    selectedWidget = editor.editing.model.getSelectedContent( editor.model.document.selection );
                    editor.SPLITREQ = false;
                    writer.model.deleteContent( editor.model.document.selection, { doNotAutoparagraph: true } );
                }
                var childData = getNextChildSamePGData( widgetData, sequence );
                if ( childData && childData.parentWrapperElement ) {
                    writer.setAttribute( 'requirementNamePrefix', childData.htmlString, requirementHeader );
                    insertPosition = writer.createPositionAfter( childData.parentWrapperElement );
                } else {
                    insertPosition = writer.createPositionAfter( parentRequirement );
                }
            } else {
                if ( editor.SPLITREQ ) {
                    selectedWidget = editor.editing.model.getSelectedContent( editor.model.document.selection );
                    editor.SPLITREQ = false;
                    writer.model.deleteContent( editor.model.document.selection, { doNotAutoparagraph: true } );
                }
                var tempArrayOfNumber = [];
                var currentChildArrayForDash = [];
                var parentRequirementForDash = [];
                var tempArrayNParentId = [];

                if( sequence[0].toString().indexOf( '-' ) > -1 ) {
                    tempArrayNParentId = findParentIdOfCurrentElement( widgetData, sequence );
                    var parentIdOfCurrentElementForDash = tempArrayNParentId[0];
                    var tempArrayOfNumberForDash = tempArrayNParentId[1];

                    //for Creating an array of all the child elements
                    for ( var index = 0; index < tempArrayOfNumberForDash.length; index++ ) {
                        if ( parentIdOfCurrentElementForDash === tempArrayOfNumberForDash[index].iinstanceData.getAttribute( 'parentid' ) ) {
                            currentChildArrayForDash.push( tempArrayOfNumberForDash[index] );
                        }
                    }
                    for( var i = currentChildArrayForDash.length - 1; i >= 0; i-- ) {
                        if( currentChildArrayForDash[i].numberString.indexOf( '-' ) > -1 ) {
                            sequence = [ currentChildArrayForDash[i].numberString ];
                            parentRequirementForDash.push( currentChildArrayForDash[i] );
                            break;
                        }
                    }
                }
                tempArrayNParentId = findParentIdOfCurrentElement( widgetData, sequence );
                parentIdOfCurrentElement = tempArrayNParentId[0];
                tempArrayOfNumber = tempArrayNParentId[1];

                // tempArrayOfNumber = tempArrayOfNumber.sort( sortAlphaNum );
                tempArrayOfNumber = cleaner( tempArrayOfNumber );

                var arrayForLoop = existingSiblingUpdate( editor, tempArrayOfNumber, parentIdOfCurrentElement, sequence );

                updateChildAsperNewSibling( editor, arrayForLoop, tempArrayOfNumber );

                //Getting next sequence for new sibling and appending into DOM
                if( sequence[0].toString().indexOf( '-' ) > -1 ) {
                    sequence2 = nextNumber( [ sequence[0].toString().split( '-' )[0] + '.0' ] );
                } else{
                    sequence2 = nextNumber( sequence );
                }
                htmlString = String( sequence2 ) + ' ';
                writer.setAttribute( 'requirementNamePrefix', htmlString, requirementHeader );

                var currentChildArray;
                if ( widgetMetaData.siblingId ) {
                    // Get an array of all the child elements
                    currentChildArray = _getArrayIndexOfGivenSequenceNumber( tempArrayOfNumber, sequence[0] );
                }

                //Case if Element is having existing Sibling
                // If Sibling for the selection is exist
                if ( arrayForLoop.length > 0 ) {
                    var seqOfNext = arrayForLoop[0];
                    parentRequirement = _getDataForGivenIndexNumber( tempArrayOfNumber, seqOfNext ).iinstanceData;
                    insertPosition = writer.createPositionBefore( parentRequirement );
                } else if ( currentChildArray && currentChildArray.length > 0 ) {
                    //Case if Element is having existing Child
                    parentRequirement = currentChildArray[currentChildArray.length - 1].iinstanceData;
                    insertPosition = writer.createPositionAfter( parentRequirement );
                } else if( sequence[0].toString().indexOf( '-' ) > -1 ) {
                    parentRequirement = parentRequirementForDash[0].iinstanceData;
                    insertPosition = writer.createPositionAfter( parentRequirement );
                } else{
                    insertPosition = writer.createPositionAfter( parentRequirement );
                }
                // Attach listeners to auto-select the initial contents
            }

            requirement.objectTypesWithIcon = widgetMetaData.objectTypesWithIcon;
            RequirementWidgetUtil.setType( writer, requirement, widgetMetaData.preferedType );
            const requirementMarker = _createMarkerWidget( widgetMetaData, writer, editor );//writer.createElement( 'requirementMarker', { id: 'foo' } );
            writer.insert( requirementMarker, writer.createPositionAt( requirement, 0 ) );
            writer.insert( requirementHeader, writer.createPositionAt( requirement, 1 ) );
            writer.insert( requirementContent, writer.createPositionAt( requirement, 2 ) );

            writer.insertText( localTextBundle.titleLabel, requirementHeader );

            if ( selectedWidget ) {
                var countChild = requirementBodyText.childCount;

                for ( var index = countChild - 1; index >= 0; index-- ) {
                    var child = requirementBodyText.getChild( index );
                    writer.remove( child );
                }
                if( selectedWidget._children._nodes.length === 1 && selectedWidget._children._nodes[0].name !== 'paragraph' ) {
                    let paragraph = writer.createElement( 'paragraph' ); // Adding empty paragraph in content to allow editing
                    writer.insert( selectedWidget, writer.createPositionAt( paragraph, 0 ) );
                    writer.insert( paragraph, writer.createPositionAt( requirementBodyText, 0 ) );
                } else if( selectedWidget._children._nodes.length > 1 ) {
                    writer.insert( selectedWidget, writer.createPositionAt( requirementBodyText, 0 ) );
                }
            }

            // Turn Trackchanges OFF temporary, to avoid track of new object creation
            var trackChangeDisabled = false;
            const command = editor.commands.get( 'trackChanges' );
            if( appCtxSvc.ctx.trackChanges && appCtxSvc.ctx.trackChanges.isOn ) {
                trackChangeDisabled = true;
                command.value = false;
                command.forceDisabled();
            }

            editor.model.insertContent( requirement, insertPosition );

            // Turn ON back
            if( trackChangeDisabled ) {
                command.value = true;
                command.clearForceDisabled();
            }
        } );
        // Highlight comments on new Requirement
        _highlightCommentsOnNewReq( this.editor, requirement );
        return requirement;
    }
    /**
     * Create and add new widget element to the editor
     *
     * @param {Object} eventData - Newly created object's html content data and addOption
     */
    _addNewlyCreatedObjectDataToEditor( eventData ) {
        const editor = this.editor;
        var htmlContentData = eventData.htmlContent;
        var selectedObject = eventData.selectedObject;
        var addOption = eventData.addOption;
        var existingWidgetFlag = eventData.existingWidgetFlag;
        var lastSavedDate = eventData.lastSavedDate;
        var wrapperElement;

        editor.ignoreDataChangeEvent = true;
        // eslint-disable-next-line complexity

        var contentElement = document.createElement( 'div' );
        contentElement.innerHTML = htmlContentData;
        var requirementDivElements = contentElement.getElementsByClassName( 'requirement' );
        var sequenceOfFirstCreated = null;
        var siblingCount = 0;

        var widgetData = editor.model.document.getRoot();

        for ( var ind = 0; ind < requirementDivElements.length; ind++ ) {
            var insertPosition = null;
            var requirementDiv = requirementDivElements[ind];

            const viewFragment = editor.data.processor.toView( requirementDiv.outerHTML );
            const modelFregment = editor.data.toModel( viewFragment );

            if ( !modelFregment || modelFregment.childCount < 1 ) { return; }

            wrapperElement = modelFregment.getChild( 0 );

            var requirementHeader = RequirementWidgetUtil.getModelElement( editor, wrapperElement, 'requirementHeader' );
            var hdStr = requirementHeader.getAttribute( 'requirementNamePrefix' );

            var seq = hdStr.split( ' ', 1 );
            if ( !sequenceOfFirstCreated ) {
                sequenceOfFirstCreated = seq[0];
                siblingCount++;
                // there are more created elements
                if ( requirementDivElements.length !== ind + 1 ) {
                    continue;
                }
            } else {
                // If child of the first created
                if ( seq[0].indexOf( sequenceOfFirstCreated ) === 0 ) {
                    // there are more created elements
                    if ( requirementDivElements.length !== ind + 1 ) {
                        continue;
                    }
                } else { // current element is the sibling of last created parent element
                    sequenceOfFirstCreated = seq[0];
                    siblingCount++;
                    // there are more created elements
                    if ( requirementDivElements.length !== ind + 1 ) {
                        continue;
                    }
                }
            }

            var selectedOBjUid = selectedObject.uid;
            var parentWrapperElement = _getWidgetFromUid( widgetData, selectedOBjUid );
            if ( !parentWrapperElement ) {
                return;
            }
            var hdrParentEle = RequirementWidgetUtil.getModelElement( editor, parentWrapperElement, 'requirementHeader' );
            var tempString = hdrParentEle.getAttribute( 'requirementNamePrefix' );

            var sequence = tempString.split( ' ', 1 );
            var tempArrayOfNumber = [];

            var parentIdOfCurrentElement;
            var innerText;
            var updatedText;
            var indexes;
            var childData;
            // If added as a child
            if ( addOption === 'CHILD' ) {
                childData = getNextChildSamePGData( widgetData, sequence );
                editor.model.change( writer => {
                    if ( childData && childData.parentWrapperElement ) {
                        if( hdStr ) {
                            childData.htmlString = hdStr;
                        }
                        writer.setAttribute( 'requirementNamePrefix', childData.htmlString, requirementHeader );
                        insertPosition = writer.createPositionAfter( childData.parentWrapperElement );
                    } else {
                        insertPosition = writer.createPositionAfter( parentWrapperElement );
                    }
                } );
            } else { // If Clicked on Add Sibling
                // create array of widgets with their respective para numbers
                for ( var iinstance = 0; iinstance < widgetData.childCount; iinstance++ ) {
                    var objWidget = widgetData.getChild( iinstance );
                    innerText = undefined;

                    if( objWidget.name === 'loading' ) { //
                        innerText = objWidget.getAttribute( 'object_string' );
                    } else {
                        var headerElement = RequirementWidgetUtil.getModelElement( editor, objWidget, 'requirementHeader' );
                        innerText = headerElement.getAttribute( 'requirementNamePrefix' );
                    }
                    if ( innerText ) {
                        innerText = headerElement.getAttribute( 'requirementNamePrefix' );
                        updatedText = innerText.replace( /(\r\n|\n|\r)/gm, '' );
                        indexes = updatedText.split( ' ', 1 );
                        tempArrayOfNumber.push( { numberString: indexes[0], iinstanceData: objWidget } );
                        if ( sequence.toString().localeCompare( indexes[0], 'en', { numeric: true } ) === 0 ) {
                            parentIdOfCurrentElement = objWidget.getAttribute( 'parentid' );
                        }
                    }
                }

                tempArrayOfNumber = tempArrayOfNumber.sort( sortAlphaNum );
                tempArrayOfNumber = cleaner( tempArrayOfNumber );

                var arrayForLoop = existingSiblingUpdate( editor, tempArrayOfNumber, parentIdOfCurrentElement, sequence, existingWidgetFlag );

                if( !existingWidgetFlag ) {
                    updateChildAsperNewSibling( editor, arrayForLoop, tempArrayOfNumber, existingWidgetFlag );
                }

                var currentChildArray;
                if ( siblingCount > 0 && arrayForLoop.length <= 0 ) {
                    currentChildArray = _getArrayIndexOfGivenSequenceNumber( tempArrayOfNumber, sequence[0] );
                }
                editor.model.change( writer => {
                    // If Sibling for the selection is exist
                    if ( arrayForLoop.length > 0 ) {
                        // Get the next sibling of the selected and insert before it
                        var seqOfNext = arrayForLoop[0];
                        var parentWrapperElement1 = _getDataForGivenIndexNumber( tempArrayOfNumber, seqOfNext ).iinstanceData;
                        insertPosition = writer.createPositionBefore( parentWrapperElement1 );
                    } else if ( currentChildArray && currentChildArray.length > 0 ) {
                        //Case if Element is having existing Child
                        var parentWrapperElement2 = currentChildArray[currentChildArray.length - 1].iinstanceData;
                        insertPosition = writer.createPositionAfter( parentWrapperElement2 );
                    } else {
                        // Insert after the last
                        insertPosition = writer.createPositionAfter( parentWrapperElement );
                    }
                } );
            }

            //set last modified date for created objects using add pannel
            if( lastSavedDate ) {
                editor.model.change( writer => {
                    writer.setAttribute( 'lmd', lastSavedDate, wrapperElement );
                } );
            }

            // Turn Trackchanges OFF temporary, to avoid track of new object creation
            var trackChangeDisabled = false;
            const command = editor.commands.get( 'trackChanges' );
            if( appCtxSvc.ctx.trackChanges && appCtxSvc.ctx.trackChanges.isOn ) {
                trackChangeDisabled = true;
                command.value = false;
                command.forceDisabled();
            }

            editor.model.insertContent( wrapperElement, insertPosition );

            // Turn ON back
            if( trackChangeDisabled ) {
                command.value = true;
                command.clearForceDisabled();
            }
        }
        editor.ignoreDataChangeEvent = false;
        if ( eventData.callback ) {
            var reqContent = {
                html: htmlContentData,
                widget: wrapperElement
            };
            eventData.callback( reqContent );
        }

        editor.eventBus.publish( 'requirementDocumentation.newElementAddedSelectionChange' );
    }
    /**
      * Get meta data information for the new widget
      *
      * @param {object} addOption //
      * @param {object} callback //
      */
    getNewWidgetMetaData( editor, addOption, options, callback ) {
        var _isChild;
        var _isSibling;
        var _parentWidget;
        var _siblingId;
        var _siblingType;
        var _parentId;
        var _parentType;
        var _parentItemType;
        var _objectTypesWithIcon;
        var _preferedType;
        var _preferedTemplate;

        var parentWidget = options.after;

        if ( parentWidget ) {
            _parentWidget = parentWidget;

            var id = parentWidget.getAttribute( 'id' );
            var type = parentWidget.getAttribute( 'objecttype' );
            var itemType = parentWidget.getAttribute( 'itemtype' );

            var pId = parentWidget.getAttribute( 'parentid' );
            var pType = parentWidget.getAttribute( 'parenttype' );
            var pItemType = parentWidget.getAttribute( 'parentitemtype' );

            var parentId = null;
            var parentType = null;
            var parentItemType = null;
            var _firstTimeCreation = '';
            // for child creation, set only parent element
            if ( addOption && addOption === 'CHILD' || !pId ) { //CHILD
                // Add widget to created child list
                if ( !parentWidget.createdChildElements ) {
                    parentWidget.createdChildElements = [];
                }
                _isChild = true;

                // set parent information
                parentId = id;
                parentType = type;
                parentItemType = itemType;
                _firstTimeCreation = pId;
            } else { // SIBLING
                // Add widget to created sibling list
                if ( !parentWidget.createdSiblingElements ) {
                    parentWidget.createdSiblingElements = [];
                }
                _isSibling = true;

                // set parent information
                parentId = pId;
                parentType = pType;
                parentItemType = pItemType;

                _siblingId = id;
                _siblingType = type;
            }

            _parentId = parentId;
            _parentType = parentType;
            _parentItemType = parentItemType;

            var typeWithIconMap = RequirementWidgetUtil.getAllowedTypesFromGlobalTypeMap( editor, parentItemType );
            if ( typeWithIconMap ) {
                _objectTypesWithIcon = typeWithIconMap.objectTypesWithIcon;
                _preferedType = typeWithIconMap.preferredType;
                _preferedTemplate = RequirementWidgetUtil.getTemplateFromGlobalTemplateMap( editor, typeWithIconMap.preferredType );
            }

            var widgetMetaData = {
                isChild: _isChild,
                isSibling: _isSibling,
                parentWidget: _parentWidget,
                siblingId: _siblingId,
                siblingType: _siblingType,
                parentId: _parentId,
                parentType: _parentType,
                parentItemType: _parentItemType,
                objectTypesWithIcon: _objectTypesWithIcon,
                preferedType: _preferedType,
                preferedTemplate: _preferedTemplate,
                firstTimeCreation: _firstTimeCreation
            };


            //  START SERVER RELATED CODE
            // If type is not cached, load it from server
            if ( !_objectTypesWithIcon ) {
                var selected = {
                    type: parentItemType
                };

                var eventData = {
                    obj: this,
                    selected: selected,
                    callback: function( response ) {
                        widgetMetaData.objectTypesWithIcon = response.objectTypesWithIcon;
                        widgetMetaData.preferedType = response.preferredType;
                        // TO DO : DON'T DELETE :
                        widgetMetaData.preferedTemplate = RequirementWidgetUtil.getTemplateFromGlobalTemplateMap( editor, response.preferredType );
                        if ( callback ) {
                            callback( this.obj, widgetMetaData );
                        }
                    }
                };
                var eventBus = editor.eventBus;
                eventBus.publish( 'ACEXRTHTMLEditor.getDisplayableTypes', eventData );
            } else {
                if ( callback ) {
                    callback( this, widgetMetaData );
                }
            }
            // END SERVER RELATED CODE

            // BY PASS : Will be deleted
            // callback( this, widgetMetaData );
            // Clear last selection
            this.editor.config.selectedRequirementWidget = null;
        }
    }


    execute( options ) {
        const editor = this.editor;

        if ( options.htmlContent && options.addOption &&
            options.selectedObject ) {
            this._addNewlyCreatedObjectDataToEditor( options );
            return;
        }

        const parentRequirement = options.after;

        if ( !parentRequirement ) {
            console.warn( 'No parent requirement passed.' );

            return;
        }

        // inserting RAT data for toggle Button
        editor.RATData.isNewRequirement = true;

        this.getNewWidgetMetaData( editor, options.addOption, options, function( obj, widgetMetaData ) {
            var req = obj._createNewWidget( widgetMetaData );
            scrollToNewWidget( req, editor );
        } );
    }
}

/**
 * Calculate the comment positions if present in the selection
 *
 * @param {Object} editor - the editor instance of ckeditor
 */
function _calculateCommentPositionPresentInSelection( editor ) {
    if( editor && editor.editing && editor.editing.view && editor.editing.view.document &&
    editor.editing.view.document.selection ) {
        var viewRange = editor.editing.view.document.selection.getFirstRange();
        if( viewRange ) {
            var totalRCHParsed = 0;
            const CommentsRepository = editor.plugins._plugins.get( 'CommentsRepository' );
            for( let item of viewRange.getItems() ) {
                if( item && item.textNode && item.textNode.parent && item.textNode.parent._attrs
                    && item.textNode.parent._attrs.get( 'data-comment' ) ) {
                    var threadId = item.textNode.parent._attrs.get( 'data-comment' );
                    var commentid = editor.fire( 'getCommentId', threadId );
                    var startRch = totalRCHParsed;
                    var endRch = startRch + item.offsetSize;
                    if( CommentsRepository && CommentsRepository._threads && CommentsRepository._threads.has( threadId ) ) {
                        var markers  = editor.model.markers._markers;
                        var markerName = null;
                        for( let [ key, value ] of markers.entries() ) {
                            if( key.indexOf( threadId ) >= 0 ) {
                                markerName = key;
                            }
                        }
                        const commentObj = {
                            reqData: {
                                commentid : commentid
                            },
                            start: {
                                rch : startRch
                            },
                            end: {
                                rch : endRch
                            },
                            threadId : threadId,
                            markerName: markerName
                        };
                        cacheCommentsPositionMap.set( threadId, commentObj );
                        totalRCHParsed += item.offsetSize;
                    }
                }else if( item && item.offsetSize ) {
                    var length = item.offsetSize;
                    totalRCHParsed += length;
                }
            }
        }
    }
}

/**
 * highlight comments on newly created requirement
 *
 * @param {Object} editor - the editor instance of ckeditor
 * @param {Object} requirement - newly created requirement
 */
function _highlightCommentsOnNewReq( editor, requirement ) {
    if( cacheCommentsPositionMap.size > 0 ) {
        editor.fire( 'highlightCommentsForSplitRequirement', cacheCommentsPositionMap, requirement );
        cacheCommentsPositionMap.clear();
    }
}

/**
* Scroll the contents to the newly added widget
*
* @param {editor} editor
* @param {requirement} widget element to scroll upto
*/
var scrollToNewWidget = function( requirement, editor ) {
    var view = editor.editing.view;
    let reqDomElement = document.getElementById( requirement.getAttribute( 'id' ) );
    let reqViewElement = editor.editing.view.domConverter.domToView( reqDomElement );

    var newselection = view.createSelection( reqViewElement, 0, { fake: true } );
    view.document.selection._setTo( newselection );
    view.scrollToTheSelection();
};

function getRandomId() {
    var randomId = Math.random().toString( 36 ).substr( 2, 10 );
    return 'RM::NEW::' + randomId;
}

function nextNumber( inputString ) {
    var tempString = inputString.toString().split( '.' );
    tempString.splice( tempString.length - 1, 1, parseInt( tempString[tempString.length - 1] ) + 1 );
    return tempString.join( '.' );
}


function getLeafChildinHierarchy( arrAllElements, currentElement ) {
    var currentChildArray = [];
    //for Creating an array of all the child elements
    for ( var index = 0; index < arrAllElements.length; index++ ) {
        if ( currentElement.id === arrAllElements[index].parentId ) {
            currentChildArray.push( arrAllElements[index] );
        }
    }
    var countChild = currentChildArray.length;
    if ( countChild > 0 ) {
        return getLeafChildinHierarchy( arrAllElements, currentChildArray[countChild - 1] );
    }
    return currentElement;
}

/**
 * Create and add new widget
 *
 * @param {Object} widgetMetaData
 */
function _createMarkerWidget( widgetMetaData, writer, editor ) {
    var requirementMarker = writer.createElement( 'requirementMarker', { id: 'foo' } );
    var markerTypeIcon = writer.createElement( 'typeicon', {
        title: editor.changeTypeTitle
    } );
    var typeIconImg = writer.createElement( 'iconImage', {
        class: 'aw-base-icon aw-aria-border',
        tabIndex: 0,
        alt: editor.requirementRevision, ondragstart: 'return false;', draggable: 'false',
        src: 'assets/image/typeRequirementRevision48.svg'
    } );

    var markerAddElement = writer.createElement( 'addelementicon', null );
    RequirementWidgetUtil.setTypeIcon( writer, typeIconImg, widgetMetaData.objectTypesWithIcon, widgetMetaData.preferedType );

    writer.insert( typeIconImg, writer.createPositionAt( markerTypeIcon, 0 ) );
    writer.insert( markerTypeIcon, writer.createPositionAt( requirementMarker, 0 ) );
    writer.insert( markerAddElement, writer.createPositionAt( requirementMarker, 1 ) );
    if ( editor.isHtmlSpecTemplate === true ) {
        var markerRemoveElement = writer.createElement( 'removeelementicon', null );
        writer.insert( markerRemoveElement, writer.createPositionAt( requirementMarker, 2 ) );
    }
    return requirementMarker;
}
/**
* Add Child Method
* @param {Object} widgetData //
* @param {String} sequence //
* @returns {Object} dataObject //
*/
function getNextChildSamePGData( widgetData, sequence ) {
    var tempArrayOfNumber = [];
    var parentIdOfCurrentElement;
    var currentChildArray = [];
    var sequence2;
    var htmlString;
    var innerText;
    var updatedText;
    var indexes;
    var parentWrapperElement;

    // for top most object there will be no para number, so consider it as a 0
    if ( !( typeof sequence[0] === 'string' && sequence[0].replace( '-', '.' ).toString().split( '.' ).every( isNumberString ) ) || typeof sequence[0].replace( '-', '.' ) === 'number' && sequence[0] || sequence[0] === '' ) {
        sequence[0] = '0';
    }

    //for Creating an array of all the instances present on page

    for ( var iinstance = 0; iinstance < widgetData.childCount; iinstance++ ) {
        var objWidget = widgetData.getChild( iinstance );
        innerText = undefined;
        if( objWidget.name === 'loading' ) {
            innerText = objWidget.getAttribute( 'object_string' );
        } else {
            var headerElement = _getRequirementHeaderElement( objWidget );
            innerText = headerElement.getAttribute( 'requirementNamePrefix' );
        }
        if ( innerText ) {
            innerText = headerElement.getAttribute( 'requirementNamePrefix' );
            updatedText = innerText.replace( /(\r\n|\n|\r)/gm, '' );
            indexes = updatedText.split( ' ', 1 );
            if ( !( typeof indexes[0] === 'string' && indexes[0].replace( '-', '.' ).toString().split( '.' ).every( isNumberString ) ) || typeof indexes[0].replace( '-', '.' ) === 'number' && indexes[0] || indexes[0] === '' ) {
                indexes[0] = '0';
            }
            var idWidget = objWidget.getAttribute( 'id' );
            var idParent = objWidget.getAttribute( 'parentid' );

            tempArrayOfNumber.push( {
                numberString: indexes[0],
                iinstanceData: objWidget,
                id: idWidget,
                parentId: idParent
            } );
            if ( sequence.toString().localeCompare( indexes[0], 'en', { numeric: true } ) === 0 ) {
                parentIdOfCurrentElement = objWidget.getAttribute( 'id' );
                parentWrapperElement = objWidget;
            }
        }
    }
    tempArrayOfNumber = tempArrayOfNumber.sort( sortAlphaNum );
    tempArrayOfNumber = cleaner( tempArrayOfNumber );

    //for Creating an array of all the child elements
    for ( var index = 0; index < tempArrayOfNumber.length; index++ ) {
        if ( parentIdOfCurrentElement === tempArrayOfNumber[index].parentId ) {
            currentChildArray.push( tempArrayOfNumber[index] );
        }
    }

    //Case if Element is having existing Child
    if ( currentChildArray && currentChildArray[0] && currentChildArray[0].iinstanceData ) {
        // If selected is the top most, Get the last element from the editor to add the created object below to it
        if ( sequence[0] === '0' ) {
            parentWrapperElement = tempArrayOfNumber[tempArrayOfNumber.length - 1].iinstanceData;
        } else {
            var element = getLeafChildinHierarchy( tempArrayOfNumber, currentChildArray[currentChildArray.length - 1] );
            parentWrapperElement = element.iinstanceData;
        }

        sequence2 = nextNumber( currentChildArray[currentChildArray.length - 1].numberString );
    } else {
        // if selected is the top most and there is not child created yet
        if ( sequence[0] === '0' ) {
            sequence2 = nextNumber( sequence[0] );
        } else {
            sequence2 = sequence.toString() + '.1';
        }
    }
    //Getting next sequence for new child and appending into DOM
    htmlString = String( sequence2 ) + ' ';

    return { htmlString: htmlString, parentWrapperElement: parentWrapperElement };
}

/**
 * Return the data for the given index number
 * @param {Array} dataArray - array of the widget instances with their respective sequence numbers
 * @param {Number} indexNo - sequence number
 * @returns {Object} dataObject
 */
function _getDataForGivenIndexNumber( dataArray, indexNo ) {
    for ( var i in dataArray ) {
        var data = dataArray[i];
        if ( data.numberString === indexNo ) {
            return data;
        }
    }
}
/**
  * Return the array of child objects for the given sequence number
  * @param {Array} dataArray - array of the widget instances with their respective sequence numbers
  * @param {Number} sequence - sequence number
  * @returns {Array} array of child objects
  */
function _getArrayIndexOfGivenSequenceNumber( dataArray, sequence ) {
    var startIndex = null;
    var currentChildArray = [];
    for ( var i in dataArray ) {
        var data = dataArray[i];
        if ( startIndex !== null ) {
            if ( data.numberString.indexOf( sequence ) === 0 ) {
                currentChildArray.push( data );
            }
        }
        if ( data.numberString === sequence ) {
            startIndex = i;
        }
    }
    return currentChildArray;
}

/** */
function _getRequirementHeaderElement( requirementElement ) {
    for ( let index = 0; index < requirementElement._children._nodes.length; index++ ) {
        const node = requirementElement._children._nodes[index];
        if( node.name === 'requirementHeader' ) {
            return node;
        }
    }
}

var childrenOfSiblingUpdate = function( editor, tempArrayOfNumber, parentIdOfCurrentElement, sequence, existingWidgetFlag ) {
    var currentChildArray = [];
    var siblingArray = [];
    var nextSibling;
    var nextToNextSibling;
    var startIndex;
    var endIndex;
    var widgetSiblingData;
    var arrayForLoop = [];

    //for Creating an array of all the child elements
    for ( var index = 0; index < tempArrayOfNumber.length; index++ ) {
        if ( parentIdOfCurrentElement === tempArrayOfNumber[index].iinstanceData.getAttribute( 'parentid' ) ) {
            currentChildArray.push( tempArrayOfNumber[index] );
        }
    }
    //for Creating an array of all the sibling elements and their index
    for ( index = 0; index < currentChildArray.length; index++ ) {
        if ( sequence.toString().localeCompare( currentChildArray[index].numberString, 'en', { numeric: true } ) < 0 ) {
            siblingArray.push( currentChildArray[index] );
        }
    }
    var attrUpdateMap = [];
    //Updating the existing indexes of the siblings
    for ( index = 0; index < siblingArray.length; index++ ) {
        var headerElement = _getRequirementHeaderElement( siblingArray[index].iinstanceData );
        if( headerElement ) {
            widgetSiblingData = headerElement.getAttribute( 'requirementNamePrefix' );

            nextSibling = widgetSiblingData.split( ' ', 1 );
            startIndex = widgetSiblingData.indexOf( ' ' );
            arrayForLoop.push( nextSibling );
            var htmlString;
            if ( !existingWidgetFlag ) {
                if ( startIndex === -1 ) {
                    htmlString = String( nextChildNumber( nextSibling ) ) + ' ';
                    // writer.setAttribute( 'requirementNamePrefix', htmlString, headerElement );
                } else {
                    htmlString = String( nextChildNumber( nextSibling ) ) + widgetSiblingData.substring( startIndex ) + ' ';
                    // writer.setAttribute( 'requirementNamePrefix', htmlString, headerElement );
                }
                attrUpdateMap.push( {
                    name: 'requirementNamePrefix',
                    value: htmlString,
                    element: headerElement
                } );
            }
        }
    }
    // Attribute update in bulk
    editor.model.change( writer => {
        attrUpdateMap.forEach( obj => {
            writer.setAttribute( obj.name, obj.value, obj.element );
        } );
    } );
    return arrayForLoop;
};
var existingSiblingUpdate = function( editor, tempArrayOfNumber, parentIdOfCurrentElement, sequence, existingWidgetFlag ) {
    var currentChildArray = [];
    var siblingArray = [];
    var nextSibling;
    var nextToNextSibling;
    var startIndex;
    var endIndex;
    var widgetSiblingData;
    var arrayForLoop = [];

    //for Creating an array of all the child elements
    for ( var index = 0; index < tempArrayOfNumber.length; index++ ) {
        if ( parentIdOfCurrentElement === tempArrayOfNumber[index].iinstanceData.getAttribute( 'parentid' ) ) {
            currentChildArray.push( tempArrayOfNumber[index] );
        }
    }
    //for Creating an array of all the sibling elements and their index
    for ( index = 0; index < currentChildArray.length; index++ ) {
        if ( sequence.toString().localeCompare( currentChildArray[index].numberString, 'en', { numeric: true } ) < 0 ) {
            siblingArray.push( currentChildArray[index] );
        }
    }
    var attrUpdateMap = [];
    //Updating the existing indexes of the siblings
    for ( index = 0; index < siblingArray.length; index++ ) {
        var headerElement = _getRequirementHeaderElement( siblingArray[index].iinstanceData );

        if( headerElement ) {
            widgetSiblingData = headerElement.getAttribute( 'requirementNamePrefix' );

            // TODO : NEED TO VALIDATE THESE CHANGES
            nextSibling = widgetSiblingData.split( ' ', 1 )[0];
            startIndex = widgetSiblingData.indexOf( ' ' );
            arrayForLoop.push( nextSibling );
            if ( !existingWidgetFlag ) {
                var htmlString;
                if ( startIndex === -1 ) {
                    htmlString = String( nextNumber( [ nextSibling.replace( '-', '.' ) ] ) ) + ' ';
                    // writer.setAttribute( 'requirementNamePrefix', htmlString, headerElement );
                } else {
                    htmlString = String( nextNumber( [ nextSibling.replace( '-', '.' ) ] ) ) + widgetSiblingData.substring( startIndex ) + ' ';
                    // writer.setAttribute( 'requirementNamePrefix', htmlString, headerElement );
                }
                attrUpdateMap.push( {
                    name: 'requirementNamePrefix',
                    value: htmlString,
                    element: headerElement
                } );
            }
        }
    }
    // Attribute update in bulk
    editor.model.change( writer => {
        attrUpdateMap.forEach( obj => {
            writer.setAttribute( obj.name, obj.value, obj.element );
        } );
    } );

    return arrayForLoop;
};

//TODO
var updateChildAsperNewSibling_old = function( editor, arrayForLoopChild, tempArrayOfNumber, existingWidgetFlag ) {
    var parentIdOfCurrentElement;
    for ( var i = 0; i < arrayForLoopChild.length; i++ ) {
        for ( var index = 0; index < tempArrayOfNumber.length; index++ ) {
            if ( isHaveChild( arrayForLoopChild[i], tempArrayOfNumber[index] ) ) {
                parentIdOfCurrentElement = tempArrayOfNumber[index].iinstanceData.getAttribute( 'parentid' );
                var arrayForIteration = childrenOfSiblingUpdate( editor, tempArrayOfNumber, parentIdOfCurrentElement, arrayForLoopChild[i], existingWidgetFlag );
                if ( arrayForIteration.length ) {
                    updateChildAsperNewSibling( editor, arrayForIteration, tempArrayOfNumber, existingWidgetFlag );
                }
            }
        }
    }
};

var updateChildAsperNewSibling = function( editor, arrayForLoopChild, tempArrayOfNumber ) {
    var parentElements = _.cloneDeep( arrayForLoopChild );
    var currentParent;
    var attrUpdateMap = [];
    for ( var index = 0; index < tempArrayOfNumber.length; index++ ) {
        var elementNo = tempArrayOfNumber[index].numberString.toString();
        if( parentElements.includes( elementNo ) ) {    // Start Parent
            _.remove( parentElements, function( n ) { return n === elementNo; } );
            currentParent = tempArrayOfNumber[index];
        } else if( currentParent && isChildOf( currentParent.numberString.toString(), elementNo ) ) {   // Update child of parent
            var updatedNo = elementNo.replace( currentParent.numberString.toString(), nextNumber( currentParent.numberString.toString() ) );
            var headerElement = _getRequirementHeaderElement( tempArrayOfNumber[index].iinstanceData );
            if( headerElement ) {
                var widgetSiblingData = headerElement.getAttribute( 'requirementNamePrefix' );
                var startIndex = widgetSiblingData.indexOf( ' ' );
                attrUpdateMap.push( {
                    name: 'requirementNamePrefix',
                    value: updatedNo + widgetSiblingData.substring( startIndex ) + ' ',
                    element: headerElement
                } );
            }
        } else if( currentParent ) {    // Reset, to check next parent
            currentParent = undefined;
        }
        if( !currentParent && parentElements.length === 0 ) {   // break, if all childs of all parent are processed
            break;
        }
    }

    // Attribute update in bulk
    _.defer( function() {
        editor.model.change( writer => {
            attrUpdateMap.forEach( obj => {
                writer.setAttribute( obj.name, obj.value, obj.element );
            } );
        } );
    } );
};

/**
 * @param {String} parentParaNo - Para number of parent
 * @param {String} childParaNo -Para number of sibling
 * @returns {Boolean} - Return true if sibling of given paranumber
 */
function isChildOf( parentParaNo, childParaNo ) {
    return childParaNo.startsWith( parentParaNo );
}

var nextChildNumber = function( inputString ) {
    var tempString = inputString.toString().split( '.' );
    tempString.splice( tempString.length - 2, 1, parseInt( tempString[tempString.length - 2] ) + 1 );
    return tempString.join( '.' );
};
var isHaveChild = function( parentSeq, allElementsArrayData ) {
    return allElementsArrayData.numberString.toString().localeCompare( parentSeq.toString() + '.1', 'en', { numeric: true } ) === 0;
};
var isNumberString = function( currentValue ) {
    if(currentValue === ""){
        return false;
    }
    return !isNaN( currentValue );
};

var sortAlphaNum = function( a, b ) {
    return a.numberString.localeCompare( b.numberString, 'en', { numeric: true } );
};


var cleaner = function( arr ) {
    return arr.filter( function( item ) {
        return typeof item.numberString === 'string' && item.numberString.replace( '-', '.' ).toString().split( '.' ).every( isNumberString ) || typeof item.numberString.replace( '-', '.' ) === 'number' && item.numberString;
    } );
};

/**
 *   @param {object} widgetData - editor root element
  *  @param {String} uid - object uid
 */
var _getWidgetFromUid = function( widgetData, uid ) {
    for ( var iinstance = 0; iinstance < widgetData.childCount; iinstance++ ) {
        var widget = widgetData.getChild( iinstance );
        if ( widget.getAttribute( 'id' ) === uid ) {
            return widget;
        }
    }
    return null;
};

var findParentIdOfCurrentElement = function( widgetData, sequence ) {
    var parentIdOfCurrentElement = [];
    var updatedText;
    var innerText;
    var indexes;
    var tempArrayOfNumber = [];
    for ( var iinstance = 0; iinstance < widgetData.childCount; iinstance++ ) {
        var objWidget = widgetData.getChild( iinstance );
        innerText = undefined;
        if( objWidget.name === 'loading' ) { //
            innerText = objWidget.getAttribute( 'object_string' );
        } else {
            var headerElement = _getRequirementHeaderElement( objWidget );
            innerText = headerElement.getAttribute( 'requirementNamePrefix' );
        }
        if ( innerText ) {
            innerText = headerElement.getAttribute( 'requirementNamePrefix' );
            updatedText = innerText.replace( /(\r\n|\n|\r)/gm, '' );
            indexes = updatedText.split( ' ', 1 );
            tempArrayOfNumber.push( { numberString: indexes[0], iinstanceData: objWidget } );
            if ( sequence.toString().localeCompare( indexes[0], 'en', { numeric: true } ) === 0 ) {
                parentIdOfCurrentElement = objWidget.getAttribute( 'parentid' );
            }
        }
    }
    return [ parentIdOfCurrentElement, tempArrayOfNumber ];
};


