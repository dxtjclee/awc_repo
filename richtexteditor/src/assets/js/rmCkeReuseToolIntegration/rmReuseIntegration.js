// Copyright (c) 2020 Siemens


import appCtxSvc from 'js/appCtxService';
import RequirmentQualityReuse from 'js/rmCkeReuseToolIntegration/reuseToolIntegrationUtil';
import { updateAutocompleteList } from 'js/rmCkeReuseToolIntegration/patternAssistHandler';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import { ckeditor5ServiceInstance } from 'js/Arm0CkeditorServiceInstance';
// Elements which should not have empty-line padding.
// Most `view.ContainerElement` want to be separate by new-line, but some are creating one structure
// together (like `<li>`) so it is better to separate them by only one "\n".
const smallPaddingElements = [ 'figcaption', 'li' ];
//var attachNodes = true;
var resizePromise;

// Array for caching Model paths of the text nodes
var markerStartPath = [];
var markerEndPath = [];
var metricIds = [];
var lastTextParent;
var totalCharParsed = 0;
var changes;
var noOfElementToIgnore = 0;
// characters to strip from start and end of the input string
var endRegExp = new RegExp( '^[^\\w]+|[^\\w]+$', 'g' );
// characters used to break up the input string into words
var breakRegExp = new RegExp( '[^\\w\'-]+', 'g' );
var openLeft = false;
var openRight = false;
// current position of instance
var currentInstancePosition = -1;
var isHighlightedOnNavigation = true;
var instancesArray = [];

export default class PlaceholderUI extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;

        subscribeEventToHandleResueCmdsInsertion( editor );


        //Default values for correction count and default flag for toggling the reuse quality commands
        this.editor.RATData = {};
        this.editor.RATData.countOfCorrection = 0;
        this.editor.RATData.currentCorrectionCount = 0;
        this.editor.RATData.toggleButtonState = false;
        editor.model.document.on( 'change:data', ( data ) => {
            let showRequirementQualityData = appCtxSvc.getCtx( 'showRequirementQualityData' );
            if( showRequirementQualityData ) {
                changes = data.source.model.document.differ.getChanges()[0];
                if( changes && changes.attributeKey === 'highlight' ) {
                    return; // Skip for highlighting
                }
                if( !changes && data.source.model.document.differ.getChangedMarkers() && data.source.model.document.differ.getChangedMarkers().length > 0 ) {
                    let trackedChange = data.source.model.document.differ.getChangedMarkers()[0];
                    if( trackedChange && trackedChange.name && trackedChange.name.startsWith( 'suggestion:deletion' ) ) {
                        trackedChange = trackedChange.data && trackedChange.data.newRange ? trackedChange.data.newRange.start : undefined;
                        if( trackedChange ) {
                            changes = { position: trackedChange };
                        }
                    }
                }
                if( resizePromise ) {
                    clearTimeout( resizePromise );
                }
                resizePromise = setTimeout( function() {
                    if ( changes ) {
                        var contectEle = changes.position;
                        if ( contectEle && contectEle.parent ) {
                            var modifiedReq = getRequirement( contectEle.parent, 'requirement' );
                            var selectedReq = editor.selectedRequirement[0];
                            var newSelectedReq = editor.newSelectedRequirement;
                            if( newSelectedReq && modifiedReq
                                    && modifiedReq.getAttribute( 'id' ) === newSelectedReq.getAttribute( 'id' ) ) {
                                updateAutocompleteList( true );
                                eventBus.publish( 'Arm0ShowQualityMetricData.CalculateQuality', eventData );
                                editor.RATData.CALCULATE_QUALITY_IN_PROCESS = true;
                            } else if( modifiedReq && selectedReq &&
                                    modifiedReq.getAttribute( 'id' ) === selectedReq.getAttribute( 'id' ) ) {
                                var text = viewToPlainText( contectEle.parent );

                                if ( eventBus ) {
                                    var eventData = {
                                        bodyText: text
                                    };
                                    updateAutocompleteList( true );
                                    eventBus.publish( 'Arm0ShowQualityMetricData.CalculateQuality', eventData );
                                    editor.RATData.CALCULATE_QUALITY_IN_PROCESS = true;
                                }
                            } else {
                                updateAutocompleteList( false );
                            }
                        }
                    }
                }, 1000 );
            }
        } );

        editor.on( 'updateCorrectionCount', function( eventData, count, instancesArray, metricIdArray ) {
            if( currentInstancePosition !== -1 ) {
                clearAllHighlight( editor );
            }
            currentInstancePosition = -1;
            editor.RATData.instances = instancesArray;
            editor.RATData.currentCorrectionCount = 0;
            findAndSavePath( instancesArray, editor, metricIdArray );
            editor.RATData.countOfCorrection = markerStartPath.length;
            RequirmentQualityReuse.updateCorrectionCount( editor );
        } );


        editor.on( 'updateQualityMatrix', function( eventData, selection, domElement, isNewRequirement, targetElement ) {
            var showRequirementQualityData = appCtxSvc.getCtx( 'showRequirementQualityData' );
            if ( showRequirementQualityData ) {
                if( targetElement ) {
                    var parent = targetElement.parentElement;
                    if( parent ) {
                        var tagName = parent.tagName;
                        tagName = tagName ? tagName.toLowerCase() : '';
                        if( tagName === 'faulticonup' || tagName === 'faulticondown' ) {
                            return;
                        }
                    }
                }
                RequirmentQualityReuse.attachPatternAssistToggle( domElement, editor, isNewRequirement );
                var requirmentContent = getRequirementContent( selection );
                editor.selectedRequirement = [ selection ];  // Assuming only single selection while quality check
                var text = viewToPlainText( requirmentContent );
                var eventBus = editor.eventBus;
                if ( eventBus ) {
                    var eventData = {
                        bodyText: text
                    };
                    eventBus.publish( 'Arm0ShowQualityMetricData.CalculateQuality', eventData );
                }
            }
        } );

        editor.on( 'disablePatternAssist', function( eventData ) {
            RequirmentQualityReuse.detachNavigationCommands( editor );
            clearInvalidWordHighlight( editor );
        } );

        editor.on( 'clearHighlightInvalidMetricData', function( event ) {
            clearInvalidWordHighlight( editor );
        } );

        editor.on( 'clearHighlightForHighlightedWord', function( event ) {
            clearAllHighlight( editor );
        } );

        editor.on( 'highlightOnNavigation', function( event, flag ) {
            clearAllHighlight( editor );
            if ( flag === 'navigateUp' ) {
                currentInstancePosition--;
            } else if ( flag === 'navigateDown' ) {
                currentInstancePosition++;
            }

            if ( currentInstancePosition > markerStartPath.length - 1 ) {
                currentInstancePosition = 0;
            }

            if ( currentInstancePosition < 0 ) {
                currentInstancePosition = markerStartPath.length - 1;
            }


            var currentStartPath = markerStartPath[currentInstancePosition];
            var currentEndPath = markerEndPath[currentInstancePosition];

            const doc = editor.model.document;
            const root = doc.getRoot();
            const metric = metricIds[currentInstancePosition];
            if ( currentInstancePosition >= 0 && currentInstancePosition <= markerStartPath.length - 1 ) {
                editor.ignoreDataChangeEvent = true;
                editor.model.change( writer => {
                    try{
                        var startPath = currentStartPath;
                        var endPath = currentEndPath;
                        const startPos = writer.createPositionFromPath( root, startPath, 'toNext' );
                        const endPos = writer.createPositionFromPath( root, endPath, 'toPrevious' );
                        const currentRange = writer.createRange( startPos, endPos );

                        writer.setAttribute( 'highlight', 'redPen', currentRange );
                        editor.RATData.currentCorrectionCount = currentInstancePosition + 1;
                        RequirmentQualityReuse.updateCorrectionCount( editor );
                    }catch( error ) {
                        //nothing to do. unable to highlight next word
                    }
                } );
                editor.ignoreDataChangeEvent = false;
            }
            isHighlightedOnNavigation = true;
            eventBus.publish( 'Arm0ShowQualityMetricData.setQualityRuleSelection', { metricId:metric } );
        } );

        const undoCommand = editor.commands.get( 'undo' );
        const redoCommand = editor.commands.get( 'redo' );
        undoCommand.on( 'execute', eventInfo => {
            if( editor.RATData && editor.RATData.toggleButtonState ) {
                editor.eventBus.publish( 'Arm0ShowQualityMetricData.CalculateQuality' );
            } else {
                return;
            }
        } );

        redoCommand.on( 'execute', eventInfo => {
            editor.eventBus.publish( 'Arm0ShowQualityMetricData.CalculateQuality' );
        } );

        editor.on( 'highlightInvalidMetricData', function( eventData, instances ) {
            //need to handle this use case when user changes the table selection
            if( !isHighlightedOnNavigation ) {
                clearAllHighlight( editor );
                const doc = editor.model.document;
                const root = doc.getRoot();
                var wordIndex;
                var currentStartPath;
                var currentEndPath;
                var tempIndex = 0;
                for( let i = 0; i < instances.length; i++ ) {
                    tempIndex = 0;
                    for( let j = 0; j < instancesArray.length; j++ ) {
                        tempIndex = instancesArray.indexOf( instances[i], j );
                        if( tempIndex > -1 ) {
                            wordIndex = tempIndex;
                            currentStartPath = markerStartPath[wordIndex];
                            currentEndPath = markerEndPath[wordIndex];
                            j = tempIndex;
                            editor.model.change( writer => {
                                try{
                                    var startPath = currentStartPath;
                                    var endPath = currentEndPath;
                                    const startPos = writer.createPositionFromPath( root, startPath, 'toNext' );
                                    const endPos = writer.createPositionFromPath( root, endPath, 'toPrevious' );
                                    const currentRange = writer.createRange( startPos, endPos );
                                    writer.setAttribute( 'highlight', 'redPen', currentRange );
                                }catch( error ) {
                                    //nothing to do
                                }
                            } );
                        } else {
                            j = instancesArray.length;
                        }
                    }
                }
                currentInstancePosition = -1;
                editor.RATData.currentCorrectionCount = currentInstancePosition + 1;
                RequirmentQualityReuse.updateCorrectionCount( editor );
            }
            isHighlightedOnNavigation = false;
        } );
    }
}

/**
 * clearAllHighlight - clears highlight of all highlighted words
 * @param{*} editor - contains the editor instance
 *
 */
var clearAllHighlight = function( editor ) {
    var currentStartPath;
    var currentEndPath;
    const doc = editor.model.document;
    const root = doc.getRoot();
    for ( let i = 0; i < instancesArray.length; i++ ) {
        currentStartPath = markerStartPath[i];
        currentEndPath = markerEndPath[i];
        editor.ignoreDataChangeEvent = true;
        editor.model.change( writer => {
            var startPath = currentStartPath;
            var endPath = currentEndPath;
            try {
                const startPos = writer.createPositionFromPath( root, startPath, 'toNext' );
                const endPos = writer.createPositionFromPath( root, endPath, 'toPrevious' );
                const currentRange = writer.createRange( startPos, endPos );
                writer.removeAttribute( 'highlight', currentRange );
            } catch ( error ) {
                console.log( 'cannot remove range' );
            }
        } );
        editor.ignoreDataChangeEvent = false;
    }
};

/**
 * Method to subscribe event to Resue Cmds Insertion in header
 *
 * @param{*} editor - contains the editor instance
 */
function subscribeEventToHandleResueCmdsInsertion( editor ) {
    eventBus.subscribe( 'Arm0ShowQualityMetricData.showReqQualityPanel', function( eventData ) {
        if ( !editor.setReuseCmdsInHeader ) {
            handleReuseCmdInsertion( eventData, editor );
        }
        editor.setReuseCmdsInHeader = true;
    } );
}

/**
 * Get header div element
 *
 * @param {Object} childrens - list of children
 * @param {String} className - the class name
 * @return {Object} h3 - the h3 element
 */
function getElementByClass( childrens, className ) {
    for( var i = 0; i < childrens.length; i++ ) {
        var child = childrens[i];
        var  classesList = child._classes;
        if( classesList && classesList.entries() ) {
            var value = classesList.entries().next().value;
            if( value && value.includes( className ) ) {
                return child;
            }
        }
    }
}

/**
 * Get h3 view element
 *
 * @param {Object} parentNode - the added widgets
 * @return {Object} h3 - the h3 element
 */
var getH3Element = function( parentNode ) {
    if( parentNode ) {
        for( var i = 0; i < parentNode._children.length; i++ ) {
            var childern = parentNode._children[i];
            if( childern && childern._children && childern._children.length > 0 ) {
                var h3 = getH3Element( childern );
                if( h3 ) {
                    return h3;
                }
            }
            if( childern && childern.name && childern.name === 'h3' ) {
                return childern;
            }
        }
    }
};

/**
 * Handles selection changes done in PWA
 *
 * @param {eventdata} eventdata - contains the uid of the selected object
 * @param{*} editor - contains the editor instance
 */
function handleReuseCmdInsertion( eventdata, editor ) {
    var viewRoot = editor.editing.view.document.getRoot();
    var viewRootChildern = viewRoot._children;

    for( var i = 0; i < viewRootChildern.length; i++ ) {
        var currChildren = viewRootChildern[i];
        var viewChildren = currChildren._children;
        var hedaerView = getElementByClass( viewChildren, 'aw-requirement-header' );
        var h3View = getH3Element( hedaerView );
        if( h3View ) {
            editor.editing.view.change( writer => {
                RequirmentQualityReuse.insertNavigationCommands( writer, editor, h3View, hedaerView );
            } );
        }
    }
}

function getRequirementModel( node, nodeName ) {
    if ( !node ) {
        return null;
    }
    var childrens = node._children._nodes;
    for ( var i = 0; i < childrens.length; i++ ) {
        if ( childrens[i].name === nodeName  ) {
            return childrens[i];
        }
    }
}


function getRegex( input ) {
    if( input.length > 1 ) {
        input = input.replace( endRegExp, '' );
        input = input.replace( breakRegExp, '|' );
        input = input.replace( /^\||\|$/g, '' );
        if( input ) {
            var re = '(' + input + ')';
            if( !openLeft ) {
                re = '\\b' + re;
            }
            if( !openRight ) {
                re += '\\b';
            }
            return new RegExp( re, 'g' );
        }
    } else {
        return input;
    }
}

function getRequirementBodyContent( node ) {
    if ( !node ) {
        return null;
    }
    for ( var i = 0; i < node.childCount; i++ ) {
        if ( node._children[i]._classes.has( 'aw-requirement-bodytext' ) ) {
            return node._children[i];
        }
    }
}

function getRequirementContent( node ) {
    if ( !node ) {
        return null;
    }
    for ( var i = 0; i < node.childCount; i++ ) {
        if ( node._children[i]._classes.has( 'aw-requirement-content' ) ) {
            return node._children[i];
        }
    }
}

function getRequirement( node, reqName ) {
    while( node ) {
        var name = node.name;
        if( name === reqName ) {
            return node;
        }
        node = node.parent;
    }
}

function findAndSavePath( instances, editor, metricIdArray ) {
    clearAllHighlight( editor );
    markerStartPath = [];
    markerEndPath = [];
    metricIds = [];
    instancesArray = [];
    noOfElementToIgnore = 0;
    var selectedRequirement = editor.newSelectedRequirement ? editor.newSelectedRequirement : editor.selectedRequirement[0];
    var requirementContent = getRequirementContent( selectedRequirement );
    var requirementBodyText = getRequirementBodyContent( requirementContent );
    var modelPath = requirementBodyText.getPath();
    var cloneModelPath = _.cloneDeep( modelPath );
    //We don't get accurate model path for <requirementContent>
    totalCharParsed = 0;
    cloneModelPath[1] = 2;
    cloneModelPath.push( 0 );
    var currentBodyTextElement = requirementBodyText;
    if ( selectedRequirement && requirementContent && requirementBodyText && cloneModelPath
        && currentBodyTextElement && instances.length !== 0 ) {
        var modelReq = editor.data.toModel( selectedRequirement );
        modelReq = getRequirementModel( modelReq._children._nodes[0], 'requirementContent' );
        modelReq = getRequirementModel( modelReq, 'requirementBodyText' );
        getModelPath( modelReq, editor, cloneModelPath, instances, metricIdArray );
    }
}
function updateNodeToSkipCount( node ) {
    if( isImmediateBodyTextModelNode( node ) ) {
        var claaAttr = node._attrs.get( 'class' );
        if( claaAttr === 'ck ck-widget__selection-handle' || claaAttr === 'ck ck-reset_all ck-widget__type-around' ) {
            noOfElementToIgnore++;
        }
    }
}
function getModelPath( modelReq, editor, cloneModelPath, instances, metricIdArray ) {
    for ( var i = 0; i < modelReq._children.length; i++ ) {
        var currentNode = modelReq._children._nodes[i];
        updateNodeToSkipCount( currentNode );
        if( isTextModelNode( currentNode ) ) {
            var text = currentNode._data;
            if( lastTextParent !== currentNode.parent ) {
                //cloneModelPath[3] = i;
                totalCharParsed  = 0;
            }
            var lowerCaseText = text.toLowerCase();
            for( var j = 0; j < instances.length; j++ ) {
                var instance = instances[j];
                var regex = getRegex( instance.toLowerCase() );
                if( regex ) {
                    var stringOccurenceIterator = lowerCaseText.matchAll( regex );
                    var currentInstance = stringOccurenceIterator.next();
                    while ( currentInstance.value ) {
                        var index = currentInstance.value.index;
                        var startPath =   currentNode.getPath();
                        startPath[0] = cloneModelPath[0];
                        savePathforCurrentIndex( totalCharParsed + index, startPath, instance, metricIdArray[j] );
                        currentInstance = stringOccurenceIterator.next();
                    }
                }
            }
            lastTextParent = currentNode.parent;
            totalCharParsed += text.length;
        }
        if( currentNode && currentNode._children && currentNode._children._nodes && currentNode._children._nodes.length > 0 ) {
            getModelPath( currentNode, editor, cloneModelPath, instances, metricIdArray );
        }
    }
}


function isBodyTextNodeNode( node ) {
    if( node && node.name ) {
        return node.name === 'requirementBodyText';
    }
    return false;
}
function isImmediateBodyTextModelNode( node ) {
    if( node &&  isBodyTextNodeNode( node.parent ) ) {
        return true;
    }
    return false;
}
function isTextModelNode( node ) {
    if ( node && node._data ) {
        return true;
    }
    return false;
}

function isTextNode( node ) {
    if ( node._textData && node._data ) {
        return true;
    }
    return false;
}


function savePathforCurrentIndex( index, currentPath, instance, metricId ) {
    var startIndex = index;
    var lengthOfWord = instance.length;
    var endIndex = startIndex + lengthOfWord;
    var startPath = _.cloneDeep( currentPath );
    startPath[startPath.length - 1] = startIndex;
    startPath[3] -= noOfElementToIgnore;
    var endPath =  _.cloneDeep( currentPath );
    endPath[endPath.length - 1] = endIndex;
    endPath[3] -= noOfElementToIgnore;
    markerStartPath.push( startPath );
    markerEndPath.push( endPath );
    metricIds.push( metricId );
    instancesArray.push( instance );
}

/**
 * Converts {@link module:engine/view/item~Item view item} and all of its children to plain text.
 *
 * @param {module:engine/view/item~Item} viewItem View item to convert.
 * @returns {String} Plain text representation of `viewItem`.
 */
function viewToPlainText( viewItem ) {
    let text = '';
    if ( viewItem.is( 'text' ) || viewItem.is( 'textProxy' ) ) {
        // If item is `Text` or `TextProxy` simple take its text data.
        text = viewItem.data;
    } else if ( viewItem.is( 'element', 'img' ) && viewItem.hasAttribute( 'alt' ) ) {
        // Special case for images - use alt attribute if it is provided.
        text = viewItem.getAttribute( 'alt' );
    } else {
        // Other elements are document fragments, attribute elements or container elements.
        // They don't have their own text value, so convert their children.
        let prev = null;
        for ( const child of viewItem.getChildren() ) {
            const childText = viewToPlainText( child );
            // Separate container element children with one or more new-line characters.
            if ( prev && ( prev.is( 'containerElement' ) || child.is( 'containerElement' ) ) ) {
                if ( smallPaddingElements.includes( prev.name ) || smallPaddingElements.includes( child.name ) ) {
                    text += '\n';
                } else {
                    text += '\n\n';
                }
            }
            text += childText;
            prev = child;
        }
    }
    return text;
}

function clearInvalidWordHighlight( editor ) {
    clearHighlighting( editor );
}

// remove highlighting for all nodes
function clearHighlighting( editor ) {
    const doc = editor.model.document;
    const root = doc.getRoot();
    if ( markerStartPath.length > 0 ) {
        editor.ignoreDataChangeEvent = true;
        editor.model.change( writer => {
            for( var i = 0; i < markerStartPath.length; i++ ) {
                try {
                    var startPath = markerStartPath[ i ];
                    var endPath = markerEndPath[ i ];
                    const startPos = writer.createPositionFromPath( root, startPath, 'toNext' );
                    const endPos = writer.createPositionFromPath( root, endPath, 'toPrevious' );
                    const currentRange = writer.createRange( startPos, endPos );
                    writer.removeAttribute( 'highlight', currentRange );
                } catch ( error ) {
                    continue;
                }
            }
        } );
        editor.ignoreDataChangeEvent = false;
    }
}

// clear highlight for single word
function clearHighlight( editor ) {
    const doc = editor.model.document;
    const root = doc.getRoot();
    var position = currentInstancePosition;
    if ( position >= 0 && position <= markerStartPath.length - 1 ) {
        editor.model.change( writer => {
            try{
                var startPath = markerStartPath[position];
                var endPath = markerEndPath[position];
                const startPos = writer.createPositionFromPath( root, startPath, 'toNext' );
                const endPos = writer.createPositionFromPath( root, endPath, 'toPrevious' );
                const currentRange = writer.createRange( startPos, endPos );
                writer.removeAttribute( 'highlight', currentRange );
            } catch( error ) {
                //nothing to do. unable to remove highlight
            }
        } );
    }
}
