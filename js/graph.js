class Node{
    constructor( name ){
        this.name = name;
        this.sources = [];
        this.targets = [];
    }
}

class Link{
    constructor(source, target, protocol){
        this.source = source;
        this.target = target;
        this.protocol = protocol;
    }
}