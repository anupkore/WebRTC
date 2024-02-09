import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

export default function MyVerticallyCenteredModal(props) {
  return (
    <Modal
    {...props}
    size="md"
    aria-labelledby="contained-modal-title-vcenter"
    centered
    backdrop="static"
    keyboard={false}
  >
    
      {/* <Modal.Title id="contained-modal-title-vcenter">
        {props.title}
      </Modal.Title> */}
    
    <Modal.Body>
      {props.children} {/* Render the children content */}
    </Modal.Body>
    {/* <Modal.Footer>
      <Button onClick={props.onHide}>Close</Button>
    </Modal.Footer> */}
  </Modal>
  );
}