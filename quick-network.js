(function () {
  'use strict';
  const CT = window.CONTINUUM, R = CT.QuickRoom;
  function localHost(name, change, fail, capacity=4) {
    let room = R.create('host', name, capacity), closed = false;
    const transport = CT.LocalTransport.createHostSession((peerId, message) => {
      try {
        if (message.type !== 'quick-action') return;
        if (!compatible(message.data.catalog)) throw Error('Actualizad Continuum en ambos móviles.');
        const action = message.data.action;
        room = R.reduce(room, peerId, action, action.type === 'join' ? room.revision : message.data.revision);
        publish();
      } catch(error) {transport.sendTo(peerId, 'quick-error', error.message);}
    });
    function publish() {
      if (closed) return;
      change(room, 'host');
      for (const id of room.members.slice(1)) transport.sendTo(id, 'quick-state', {room, you:id});
    }
    queueMicrotask(publish);
    return {kind:'local', host:true, act(action) {room=R.reduce(room,'host',action);publish();}, async invite() {const peer=transport.addPeer();peer.peerConnection.addEventListener('connectionstatechange',()=>{if(!closed && ['disconnected','failed','closed'].includes(peer.peerConnection.connectionState))fail(Error('Un móvil se ha desconectado. Mantened la sala abierta y comprobad la red Wi-Fi.'));});return {signal:await peer.offerSignal(),accept:peer.acceptAnswer};}, close(){closed=true;transport.closeAll();}};
  }
  function localGuest(signal, name, change, fail) {
    let room, you, closed=false;
    const peer=CT.LocalTransport.createGuestPeer(signal, message=>{
      try {
        if(message.type==='quick-state') {room=R.validate(message.data.room);you=message.data.you;change(room,you);}
        if(message.type==='quick-error') fail(Error(message.data));
      } catch(error){fail(error);}
    },()=>peer.send('quick-action',{catalog:fingerprint(),action:{type:'join',name}}));
    peer.peerConnection.addEventListener('connectionstatechange',()=>{if(!closed && ['disconnected','failed','closed'].includes(peer.peerConnection.connectionState))fail(Error('Se ha perdido la conexión con quien creó la sala. Comprobad la red Wi-Fi.'));});
    return {kind:'local',host:false, answer:peer.answerSignal, act(action){if(!room||!peer.isReady())throw Error('Se ha perdido la conexión con quien creó la sala.');peer.send('quick-action',{catalog:fingerprint(),action,revision:room.revision});},close(){closed=true;peer.close();}};
  }
  // Presentation changes do not alter the cards/rules required to resume a game.
  function fingerprint(){return CT.seedFrom(JSON.stringify({version:CT.QuickCatalog.version,challenges:CT.QuickCatalog.challenges.map(c=>({id:c.id,direction:c.direction,cards:c.cards.map(x=>({id:x.id,value:x.value}))}))}));}
  // v564 uses the same cards and values, but hashed illustrations and descriptions too.
  function compatible(value){return value===fingerprint()||(value===2351751673&&fingerprint()===1085063415);}
  async function internet(options) {return (await import('./quick-online.js')).connect(options);}
  async function mine() {return (await import('./quick-online.js')).mine();}
  async function actOnce(code, action, expected) {return (await import('./quick-online.js')).actOnce(code, action, expected);}
  async function cancelRoom(code) {return (await import('./quick-online.js')).cancelRoom(code);}
  CT.QuickNetwork={localHost,localGuest,internet,mine,cancelRoom,actOnce,fingerprint,compatible};
})();
