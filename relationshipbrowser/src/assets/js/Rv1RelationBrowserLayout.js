// Copyright (c) 2023 Siemens

/**
 * This module defines layout related functions
 *
 * @module js/Rv1RelationBrowserLayout
 */
import _ from 'lodash';
import graphConstants from 'js/graphConstants';

export let incUpdateActive = function( layout ) {
    return layout && layout.type === 'IncUpdateLayout' && layout.isActive();
};

export let sortedLayoutActive = function( layout ) {
    return layout && layout.type === 'SortedLayout' && layout.isActive();
};

const removeObjectsFromSortedLayout = function( layout, graphItems ) {
    if( !layout || !graphItems || !sortedLayoutActive( layout ) ) {
        return;
    }

    _.each( graphItems.nodes, function( item ) {
        if( layout.containsNode( item ) ) {
            // only remove nodes, related edges, ports will be removed automatically
            layout.removeNode( item );
        }
    } );
};

const resetLayoutData = function( layout ) {
    if( !layout.data ) {
        layout.data = {};
    }

    if( layout.type === graphConstants.DFLayoutTypes.SortedLayout ) {
        layout.data.itemsToBeRemoved = {
            nodes: [],
            edges: []
        };
        layout.data.itemsToBeFilterOff = {
            nodes: [],
            edges: []
        };
        layout.data.itemsToBeFilterOn = {
            nodes: [],
            edges: []
        };
    }
};

const concatDiffMerge = function( destObj, sourceObj, remove ) {
    if( !sourceObj ) {
        return;
    }

    // handle array case
    if( _.isArray( destObj ) ) {
        if( !remove ) {
            destObj = _.union( destObj, sourceObj );
        } else {
            destObj = _.difference( destObj, sourceObj );
        }
    } else {
        // handle object case
        _.forOwn( destObj, function( value, key ) {
            if( _.isArray( value ) && _.has( sourceObj, key ) ) {
                if( !remove ) {
                    destObj[key] = _.union( value, sourceObj[key] );
                } else {
                    destObj[key] = _.difference( value, sourceObj[key] );
                }
            }
        } );
    }
};

const updateToSortedLayout = function( layout, eventType, eventData ) {
    if( !layout || !eventType || !eventData ) {
        return;
    }

    if( eventType === 'itemsRemoved' ) {
        concatDiffMerge( layout.data.itemsToBeRemoved, eventData, false );
    } else if( eventType === 'visibilityChanged' ) {
        concatDiffMerge( layout.data.itemsToBeFilterOff, eventData, !eventData.visible );
        concatDiffMerge( layout.data.itemsToBeFilterOn, eventData, eventData.visible );
    }
};

export let updateToLayout = function( layout, eventType, eventData ) {
    if( !layout || !eventType || !eventData ) {
        return;
    }

    if( !layout.data ) {
        resetLayoutData( layout );
    }

    if( sortedLayoutActive( layout ) ) {
        updateToSortedLayout( layout, eventType, eventData );
    }
};

const checkNeedToUpdate = function( objects ) {
    const result = _.find( [].concat( objects ), function( obj ) {
        if( _.isArray( obj ) ) {
            return obj.length > 0;
        }

        let validObj;
        _.each( obj, function( value /*, key */ ) {
            if( _.isArray( value ) && value.length > 0 ) {
                // break loop
                validObj = obj;
                return false;
            }
        } );

        if( validObj ) {
            return true;
        }
    } );

    return result !== undefined;
};

const applySortedLayoutUpdate = function( layout ) {
    if( !layout || !layout.data ) {
        return;
    }

    const check = [].concat( [ layout.data.itemsToBeRemoved, layout.data.itemsToBeFilterOn, layout.data.itemsToBeFilterOff ] );
    if( !checkNeedToUpdate( check ) ) {
        return;
    }

    layout.applyUpdate( function() {
        removeObjectsFromSortedLayout( layout, layout.data.itemsToBeRemoved );

        // Remove duplicates between filter On/Off objects

        const itemsToBeFilterOn = _.assign( {}, layout.data.itemsToBeFilterOn );
        itemsToBeFilterOn.nodes = _.difference( layout.data.itemsToBeFilterOn.nodes, layout.data.itemsToBeFilterOff.nodes );
        itemsToBeFilterOn.edges = _.difference( layout.data.itemsToBeFilterOn.edges, layout.data.itemsToBeFilterOff.edges );

        // turn filter on for objects
        if( itemsToBeFilterOn.nodes.length > 0 || itemsToBeFilterOn.edges.length > 0 ) {
            layout.filterOn( itemsToBeFilterOn.nodes, itemsToBeFilterOn.edges );
        }

        const itemsToBeFilterOff = {};
        itemsToBeFilterOff.nodes = [];
        itemsToBeFilterOff.edges = [];

        // only add objects that are not already in layout
        for( const node of layout.data.itemsToBeFilterOff.nodes ) {
            if( !layout.containsNode( node ) ) {
                itemsToBeFilterOff.nodes.push( node );
            }
        }

        for( const edge of layout.data.itemsToBeFilterOff.edges ) {
            if( !layout.containsEdge( edge ) ) {
                const sourceNode = edge.getSourceNode();
                const targetNode = edge.getTargetNode();

                if( ( layout.containsNode( sourceNode ) || itemsToBeFilterOff.nodes.indexOf( sourceNode ) >= 0 ) &&
                    ( layout.containsNode( targetNode ) || itemsToBeFilterOff.nodes.indexOf( targetNode ) >= 0 ) ) {
                    itemsToBeFilterOff.edges.push( edge );
                }
            }
        }

        // turn filter off for objects
        if( itemsToBeFilterOff.nodes.length > 0 || itemsToBeFilterOff.edges.length > 0 ) {
            layout.filterOff( itemsToBeFilterOff.nodes, itemsToBeFilterOff.edges );
        }
    } );
};

/**
 * apply bunch layout update when graph has changes
 *
 * @param {graphControl} graphControl the graphControl instance
 */
export let applyLayoutUpdate = function( graphControl ) {
    const layout = graphControl.layout;
    if( !layout ) {
        return;
    }
    if( layout.type === graphConstants.DFLayoutTypes.SortedLayout ) {
        applySortedLayoutUpdate( layout );
    }

    resetLayoutData( layout );
};

const exports = {
    incUpdateActive,
    sortedLayoutActive,
    resetLayoutData,
    updateToLayout,
    applyLayoutUpdate
};
export default exports;
