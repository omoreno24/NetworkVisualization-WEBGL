/* structure to store graph related information.
this way the gaph node structure is clean and 
free of any specific implementation for this graph*/
class NodeGraphInfo{
    constructor( ){
        this.position = new THREE.Vector3( 0,0,0 );
        this.mesh = null;
        this.textElement = null;
        this.circunference = 0;
    }

    setPosition( position,  shouldUpdate ){
        this.position.set( position.x, position.y, position.z );
        
        if( shouldUpdate === undefined )
            this.setMeshPosition( position );
        
    }

    updateMeshPosition( ){
        this.setMeshPosition(this.position);
    }

    setMeshPosition( position ){
        if( this.mesh != null ) 
            this.mesh.position.set( position.x, position.y, position.z );
    }

    getPosition ( ){
        return this.position.clone( );
    }
}

/* Class that implements circular drawing of the nodes*/
class CircularGraph
{
    constructor( nodeDiameter, spacing, nodes, links )
    {
        this.nodeDiameter = nodeDiameter;
        this.spacing = spacing;

        this.nodes = nodes;
        this.links = links;

        this.nodeInfo = { };
        
        //add unique identifier for each node
        this.nodes.forEach( ( node, index ) => node.id = index );

        let getRandomColor = ( ) => {
            var letters = '0123456789ABCDEF';
            var color = '#';
            for ( var i = 0; i < 6; i++ ) {
              color += letters[ Math.floor( Math.random() * 16 ) ];
            }
            return color;
        }

        //initializes NodeInfo for the specified node
        let addNodeInfo = ( node ) => {
            if( typeof this.nodeInfo[ node.id ] == "undefined" ){
                this.nodeInfo[ node.id ] = new NodeGraphInfo(nodeDiameter, spacing);
            }
        }

        //add relationship between nodes
        links.forEach( link => {
            addNodeInfo( link.source );
            addNodeInfo( link.target );

            link.source.targets.push( link.target );
            link.target.sources.push( link.source );
        });

        this.nodes = this.nodes.sort( ( nodeA, nodeB ) => {
            return ( nodeB.sources.length ) - ( nodeA.sources.length );
        })

        this.protocolColors  = {}; //stores color by protocol
        
        /*COLOR AND LEGEND INITIALIZATION*/
        let elementTarget = document.getElementById( "graphic-legend" );
       
        if( elementTarget !== undefined )
        {
            elementTarget = elementTarget.getElementsByTagName("ul")[0];

            let elementTemplate = document.createElement( "li" );
            elementTemplate.className = "list-group-item";
            
            //Asign for each protocol and ad it to the legend
            this.links.forEach( link => {
                if( this.protocolColors[ link.protocol ] == undefined )
                {
                    let colorString, element, colorElement = null;

                    colorString = getRandomColor( );

                    colorElement = document.createElement("span");
                    colorElement.style.backgroundColor = colorString;

                    element = elementTemplate.cloneNode( );

                    element.textContent = link.protocol;
                    element.append( colorElement );
                    elementTarget.append( element );

                    let color = new THREE.Color( colorString );
                    
                    this.protocolColors[ link.protocol ] = color;
                }
            });
        }
        /*END OF COLOR AND LEGEND INITIALIZATION*/
    }

    // generates the graph and return the geometry to be added into schene
    async generate(  ) {

        await this.updateNodeArragement( );
        await this.generateText( );
        
        let nodes = this.getNodeMesh( );
        let links = this.generateLinkMesh( );
        
        return [ ...await links, ...await nodes ];
    }

    // return mesh for each nodes
    async getNodeMesh( ){
        const geometry = new THREE.CircleGeometry( this.nodeDiameter / 2, 32 );
        const circle = new THREE.Mesh( geometry );

        let promises = this.nodes.map( async ( node ) => {
            var object = circle.clone( );
            
            //turn the color of the object as the node contains more targets
            object.material = new THREE.MeshBasicMaterial( { color: new THREE.Color( node.targets.length / this.nodes.length, 0.3, 0.3 ) } );

            this.nodeInfo[ node.id ].mesh = object;
            this.nodeInfo[ node.id ].updateMeshPosition( ); //set the mesh as the position of the node

            return object;
        });

        return await Promise.all( promises );
    }

    // return an arrow mesh for reach link
    async generateLinkMesh( ){

        let promises = this.links.map( async ( link ) => {
            const from = this.nodeInfo[ link.source.id ].position.clone( );
            const to = this.nodeInfo[ link.target.id ].position.clone( );

            const direction = to.sub( from );

            // to make sure arrows stay ouside of the node
            const length = direction.length( ) - this.nodeDiameter * 1.5; 

            direction.normalize( );
            
            //to force line to start afer certain distance from radius
            from.add( direction.clone( ).multiplyScalar( this.nodeDiameter / 1.7 ) );

            let color =  this.protocolColors[ link.protocol ].clone(); //get color from protocol
            
            let arrow = new THREE.ArrowHelper( direction, from, length, color.getHex (), 1.5, 1.5 );

            return  arrow;
        });

        return await Promise.all( promises );
    }
    
    // generate a text element foreach node
    async generateText( ) {
        this.nodes.forEach( node => {
            let element = document.createElement( "span" );
            let childElelement = document.createElement( "span" );
            
            element.textContent = node.name;
            element.style.position = "absolute";
            element.style.color = "white";
            element.style.zIndex = 88888;
            
            this.nodeInfo[ node.id ].textElement = element;

            document.body.appendChild( element );
        });
    }

    // update the logical position of each node
    async updateNodeArragement( ) {
        let bias, nodeLength, outsiderLength, circunference, radius = null;
        
        bias = 20; //amount of targets needed to be considered a highly conected node
        nodeLength = this.nodes.length;
        outsiderLength = this.nodes.filter( node => node.targets.length < bias ).length;
        
        circunference = ( this.nodeDiameter + this.spacing ) * outsiderLength;
        radius = circunference / ( 2 * Math.PI );

        let outsiderCount = 0;

        let promises = [];

        //asign a position in the circle to all nodes
        for( var i = 0; i < nodeLength; i++ ){
            promises.push((async () => {
                const angle = ( ( Math.PI * 2 ) / outsiderLength ) * (outsiderCount);
                const x =  ( this.nodeDiameter / 2 ) +  Math.cos( angle ) * radius;
                const y =  ( this.spacing / 2 ) +  Math.sin( angle ) * radius;
                
                this.nodeInfo[ this.nodes[ i ].id ].setPosition( new THREE.Vector3( x, y, -5 ) );

                //just ousiders nodes will have a exclusive position in the circle
                if( this.nodes[ i ].targets.length < bias )
                {
                    outsiderCount++; 
                }
            })());
        }

        await Promise.all( promises );

        let scope = this;

        //moves the position of all highly connected node to the average position of it's target connections
        promises = this.nodes.filter( node => node.targets.length >= bias ).map( async ( node ) => {
            let position = new THREE.Vector3( 0,0,0 );

            node.targets.forEach( target => position.add( this.nodeInfo[ target.id ].position ) );

            this.nodeInfo[ node.id ].setPosition( position.divideScalar( node.targets.length ) );
        });
    }

    // updates the position of every hud elements of the graphic( currently only text )
    async UpdateIndicators( ) {
        this.nodes.forEach( node => {
            let element = this.nodeInfo[ node.id ].textElement;
            let position = this.nodeInfo[ node.id ].position.clone();
            
            let windpos = WebglToDocumentPosition( position );

            if(position.x == 0) position.x += 0.01;//prevent division by 0

            let angle = -Math.atan(position.y / position.x);

            element.style.transform = 'rotate('+angle+'rad)';        
            element.style.left = windpos.x + "px";
            element.style.top = windpos.y + "px";
        });
    }
}