(function () {
  'use strict';
  const CT = window.CONTINUUM, R = CT.QuickRoom;
  function localHost(name, change, fail) {
    let room = R.create('host', name), closed = false;
    const transport = CT.LocalTransport.createHostSession((peerId, message) => {
      try {
        if (message.type !== 'quick-action') return;
        if (message.data.catalog !== fingerprint()) throw Error('Actualizad Continuum en ambos móviles.');
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
  function fingerprint(){return CT.seedFrom(JSON.stringify(CT.QuickCatalog));}
  async function internet(options) {return (await import('./quick-online.js')).connect(options);}
  CT.QuickNetwork={localHost,localGuest,internet,fingerprint};
})();
